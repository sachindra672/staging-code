import { Request, Response } from "express";
import { prisma } from "../misc";
import { Decimal } from "@prisma/client/runtime/library";
import { applyTransaction, ensureWallet, spendWithExpiryFirst } from "../config/sisyacoinHelperFunctions";

// Get active store items
export async function getStoreItems(req: Request, res: Response) {
    try {
        const { category, page = 1, limit = 50 } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const skip = (pageNumber - 1) * pageSize;

        const where: any = {
            isActive: true
        };

        if (category) {
            where.category = category;
        }

        const [items, total] = await Promise.all([
            prisma.sisyaStoreItem.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" }
            }),
            prisma.sisyaStoreItem.count({ where })
        ]);

        return res.json({
            success: true,
            data: items,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error("Error getting store items:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Admin: Create store item
export async function createStoreItem(req: Request, res: Response) {
    try {
        const { name, description, imageUrl, priceCoins, originalCoins, stock, category, metadata } = req.body;

        if (!name || !priceCoins) {
            return res.status(400).json({
                success: false,
                message: "name and priceCoins are required"
            });
        }

        const item = await prisma.sisyaStoreItem.create({
            data: {
                name,
                description,
                imageUrl,
                priceCoins: new Decimal(priceCoins),
                originalCoins: originalCoins ? new Decimal(originalCoins) : null,
                stock: stock ? parseInt(stock) : 0,
                category,
                metadata,
                isActive: true
            }
        });

        return res.json({ success: true, data: item });
    } catch (error) {
        console.error("Error creating store item:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Admin: Update store item
export async function updateStoreItem(req: Request, res: Response) {
    try {
        const { id,name, description, imageUrl, priceCoins, originalCoins, stock, category, metadata, isActive } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (priceCoins !== undefined) updateData.priceCoins = new Decimal(priceCoins);
        if (originalCoins !== undefined) updateData.originalCoins = originalCoins ? new Decimal(originalCoins) : null;
        if (stock !== undefined) updateData.stock = parseInt(stock);
        if (category !== undefined) updateData.category = category;
        if (metadata !== undefined) updateData.metadata = metadata;
        if (isActive !== undefined) updateData.isActive = isActive;

        const item = await prisma.sisyaStoreItem.update({
            where: { id },
            data: updateData
        });

        return res.json({ success: true, data: item });
    } catch (error) {
        console.error("Error updating store item:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Create order using coins
export async function createOrder(req: Request, res: Response) {
    try {
        const { items } = req.body; // [{ itemId, quantity }]

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "items array is required"
            });
        }

        const user = req.user;
        const role = req.role;

        if (role !== "user") {
            return res.status(403).json({
                success: false,
                message: "Only end users can create orders"
            });
        }

        // Get user ID and wallet
        const userId = user?.user || user?.id || user?.selfId;
        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID not found" });
        }

        const endUser = await prisma.endUsers.findFirst({
            where: {
                OR: [
                    { id: typeof userId === 'number' ? userId : parseInt(userId) || 0 },
                    { phone: typeof userId === 'string' ? userId : String(userId) }
                ]
            },
            select: { id: true }
        });

        if (!endUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const wallet = await ensureWallet("ENDUSER", endUser.id);

        // Validate items and calculate total
        let totalCoins = new Decimal(0);
        const orderItems: Array<{ itemId: string; quantity: number; priceAtPurchase: Decimal }> = [];

        for (const itemReq of items) {
            const { itemId, quantity } = itemReq;

            if (!itemId || !quantity || quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Each item must have itemId and positive quantity"
                });
            }

            const item = await prisma.sisyaStoreItem.findUnique({
                where: { id: itemId }
            });

            if (!item || !item.isActive) {
                return res.status(404).json({
                    success: false,
                    message: `Item ${itemId} not found or inactive`
                });
            }

            if (item.stock < quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for item ${item.name}. Available: ${item.stock}, Requested: ${quantity}`
                });
            }

            const itemTotal = item.priceCoins.times(quantity);
            totalCoins = totalCoins.plus(itemTotal);

            orderItems.push({
                itemId,
                quantity,
                priceAtPurchase: item.priceCoins
            });
        }

        // Check wallet balance (including expiring balances)
        const expiringBalances = await prisma.sisyaExpiryBalance.findMany({
            where: {
                walletId: wallet.id,
                isExpired: false,
                expiresAt: { gt: new Date() }
            }
        });

        const totalExpiringAvailable = expiringBalances.reduce(
            (sum, eb) => sum.plus(eb.amountTotal.minus(eb.amountUsed).minus(eb.amountExpired)),
            new Decimal(0)
        );

        const totalAvailable = wallet.spendableBalance.plus(totalExpiringAvailable);

        if (totalAvailable.lt(totalCoins)) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance",
                required: totalCoins.toString(),
                available: totalAvailable.toString()
            });
        }

        // Spend coins - pahle expiry wala
        const spendResult = await spendWithExpiryFirst(wallet.id, totalCoins);

        if (!spendResult.success) {
            return res.status(400).json({
                success: false,
                message: "Failed to process payment"
            });
        }

        // Create order
        const order = await prisma.sisyaStoreOrder.create({
            data: {
                walletId: wallet.id,
                ownerType: "ENDUSER",
                ownerId: endUser.id,
                totalCoins,
                status: "COMPLETED",
                completedAt: new Date(),
                items: {
                    create: orderItems.map(oi => ({
                        itemId: oi.itemId,
                        quantity: oi.quantity,
                        priceAtPurchase: oi.priceAtPurchase
                    }))
                }
            },
            include: {
                items: {
                    include: {
                        item: true
                    }
                }
            }
        });

        // Update item stock
        for (const oi of orderItems) {
            await prisma.sisyaStoreItem.update({
                where: { id: oi.itemId },
                data: {
                    stock: { decrement: oi.quantity }
                }
            });
        }

        // Create item-level transactions
        for (const orderItem of order.items) {
            await applyTransaction(
                wallet.id,
                "PURCHASE_ITEM",
                orderItem.priceAtPurchase.times(orderItem.quantity).negated(),
                "SPENDABLE",
                wallet.spendableBalance, 
                wallet.spendableBalance.minus(orderItem.priceAtPurchase.times(orderItem.quantity)),
                {
                    orderId: order.id,
                    itemId: orderItem.itemId,
                    itemName: orderItem.item.name,
                    quantity: orderItem.quantity
                }
            );
        }

        return res.json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error("Error creating order:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Get my orders
export async function getMyOrders(req: Request, res: Response) {
    try {
        const { page = 1, limit = 50 } = req.query;
        const user = req.user;
        const role = req.role;

        if (role !== "user") {
            return res.status(403).json({
                success: false,
                message: "Only end users can access this"
            });
        }

        const userId = user?.user || user?.id || user?.selfId;
        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID not found" });
        }

        const endUser = await prisma.endUsers.findFirst({
            where: {
                OR: [
                    { id: typeof userId === 'number' ? userId : parseInt(userId) || 0 },
                    { phone: typeof userId === 'string' ? userId : String(userId) }
                ]
            },
            select: { id: true }
        });

        if (!endUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const wallet = await prisma.sisyaWallet.findUnique({
            where: {
                ownerType_ownerId: {
                    ownerType: "ENDUSER",
                    ownerId: endUser.id
                }
            }
        });

        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const skip = (pageNumber - 1) * pageSize;

        const [orders, total] = await Promise.all([
            prisma.sisyaStoreOrder.findMany({
                where: { walletId: wallet.id },
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" },
                include: {
                    items: {
                        include: {
                            item: true
                        }
                    }
                }
            }),
            prisma.sisyaStoreOrder.count({
                where: { walletId: wallet.id }
            })
        ]);

        return res.json({
            success: true,
            data: orders,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error("Error getting orders:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Get order by ID
export async function getOrderById(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const order = await prisma.sisyaStoreOrder.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        item: true
                    }
                },
                wallet: {
                    select: {
                        ownerType: true,
                        ownerId: true
                    }
                }
            }
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        return res.json({ success: true, data: order });
    } catch (error) {
        console.error("Error getting order:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Admin: Refund order
export async function refundOrder(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const order = await prisma.sisyaStoreOrder.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        item: true
                    }
                },
                wallet: true
            }
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status === "REFUNDED") {
            return res.status(400).json({ success: false, message: "Order already refunded" });
        }

        if (order.status !== "COMPLETED") {
            return res.status(400).json({ success: false, message: "Only completed orders can be refunded" });
        }

        const adminUser = req.user;
        const adminId = adminUser?.user || adminUser?.id || adminUser?.selfId;

        // Refund coins to wallet
        const balanceBefore = order.wallet.spendableBalance;
        const balanceAfter = balanceBefore.plus(order.totalCoins);

        await prisma.sisyaWallet.update({
            where: { id: order.walletId },
            data: {
                spendableBalance: balanceAfter,
                totalSpent: order.wallet.totalSpent.minus(order.totalCoins)
            }
        });

        // Create refund transaction
        await applyTransaction(
            order.walletId,
            "PURCHASE_REFUND",
            order.totalCoins,
            "SPENDABLE",
            balanceBefore,
            balanceAfter,
            { reason: reason || "Order refund", orderId: order.id },
            undefined,
            undefined,
            "ADMIN",
            typeof adminId === 'number' ? adminId : parseInt(adminId) || undefined
        );

        // Restore item stock
        for (const orderItem of order.items) {
            await prisma.sisyaStoreItem.update({
                where: { id: orderItem.itemId },
                data: {
                    stock: { increment: orderItem.quantity }
                }
            });

            // Create item refund transaction
            await applyTransaction(
                order.walletId,
                "PURCHASE_ITEM_REFUND",
                orderItem.priceAtPurchase.times(orderItem.quantity),
                "SPENDABLE",
                balanceBefore,
                balanceAfter,
                {
                    reason: reason || "Order item refund",
                    orderId: order.id,
                    itemId: orderItem.itemId
                },
                undefined,
                undefined,
                "ADMIN",
                typeof adminId === 'number' ? adminId : parseInt(adminId) || undefined
            );
        }

        // Update order status
        const updatedOrder = await prisma.sisyaStoreOrder.update({
            where: { id },
            data: {
                status: "REFUNDED",
                refundedAt: new Date()
            },
            include: {
                items: {
                    include: {
                        item: true
                    }
                }
            }
        });

        return res.json({ success: true, data: updatedOrder });
    } catch (error) {
        console.error("Error refunding order:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

