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
        const { id, name, description, imageUrl, priceCoins, originalCoins, stock, category, metadata, isActive } = req.body;

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

        const { userId } = req.body;
        const role = req.role;

        if (role !== "user") {
            return res.status(403).json({
                success: false,
                message: "Only end users can create orders"
            });
        }

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required in request body" });
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
                    reason: `Item purchased: ${orderItem.item.name}`,
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

export async function createOrder2(req: Request, res: Response) {
    try {
        const { items, address } = req.body; // [{ itemId, quantity }], address (optional)

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "items array is required"
            });
        }

        const { userId } = req.body;
        const role = req.role;

        if (role !== "user") {
            return res.status(403).json({
                success: false,
                message: "Only end users can create orders"
            });
        }

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required in request body" });
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

        // Validate items and calculate total (read-only operations, no side effects)
        let totalCoins = new Decimal(0);
        const orderItems: Array<{ itemId: string; quantity: number; priceAtPurchase: Decimal; itemName: string }> = [];

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
                priceAtPurchase: item.priceCoins,
                itemName: item.name
            });
        }

        // Check wallet balance (including expiring balances) - read-only
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

        // All database writes wrapped in transaction
        const order = await prisma.$transaction(async (tx) => {
            // Re-check stock within transaction (optimistic locking)
            for (const oi of orderItems) {
                const item = await tx.sisyaStoreItem.findUnique({
                    where: { id: oi.itemId },
                    select: { stock: true }
                });

                if (!item || item.stock < oi.quantity) {
                    throw new Error(`Insufficient stock for item ${oi.itemId}. Available: ${item?.stock || 0}, Requested: ${oi.quantity}`);
                }
            }

            // Get fresh wallet data within transaction
            const walletInTx = await tx.sisyaWallet.findUnique({
                where: { id: wallet.id }
            });

            if (!walletInTx) {
                throw new Error("Wallet not found");
            }

            // Re-check balance within transaction
            const expiringBalancesInTx = await tx.sisyaExpiryBalance.findMany({
                where: {
                    walletId: wallet.id,
                    isExpired: false,
                    expiresAt: { gt: new Date() }
                }
            });

            const totalExpiringAvailableInTx = expiringBalancesInTx.reduce(
                (sum, eb) => sum.plus(eb.amountTotal.minus(eb.amountUsed).minus(eb.amountExpired)),
                new Decimal(0)
            );

            const totalAvailableInTx = walletInTx.spendableBalance.plus(totalExpiringAvailableInTx);

            if (totalAvailableInTx.lt(totalCoins)) {
                throw new Error("Insufficient balance");
            }

            // Spend coins - expiry first logic within transaction
            let remaining = totalCoins;
            let expiryUsed = new Decimal(0);
            let normalUsed = new Decimal(0);

            // Use expiring balances first
            for (const expBal of expiringBalancesInTx) {
                if (remaining.lte(0)) break;

                const available = expBal.amountTotal.minus(expBal.amountUsed).minus(expBal.amountExpired);
                if (available.lte(0)) continue;

                const toUse = Decimal.min(remaining, available);
                const newAmountUsed = expBal.amountUsed.plus(toUse);

                await tx.sisyaExpiryBalance.update({
                    where: { id: expBal.id },
                    data: { amountUsed: newAmountUsed }
                });

                expiryUsed = expiryUsed.plus(toUse);
                remaining = remaining.minus(toUse);
            }

            // Use normal spendable balance for remainder
            if (remaining.gt(0)) {
                if (walletInTx.spendableBalance.lt(remaining)) {
                    throw new Error("Insufficient spendable balance");
                }
                normalUsed = remaining;
            }

            // Update wallet balance
            const balanceBefore = walletInTx.spendableBalance;
            const balanceAfter = balanceBefore.minus(normalUsed);

            await tx.sisyaWallet.update({
                where: { id: wallet.id },
                data: {
                    spendableBalance: balanceAfter,
                    totalSpent: walletInTx.totalSpent.plus(totalCoins)
                }
            });

            // Create order first to get order ID for transaction metadata
            const orderData: any = {
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
            };

            if (address !== undefined) {
                orderData.address = address;
            }

            const newOrder = await tx.sisyaStoreOrder.create({
                data: orderData,
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
                await tx.sisyaStoreItem.update({
                    where: { id: oi.itemId },
                    data: {
                        stock: { decrement: oi.quantity }
                    }
                });
            }

            // Create single main purchase transaction with all item details in metadata
            const itemsSummary = orderItems.map(oi => `${oi.quantity}x ${oi.itemName}`).join(", ");
            const itemsDetails = newOrder.items.map(item => ({
                itemId: item.itemId,
                itemName: item.item.name,
                quantity: item.quantity,
                priceAtPurchase: item.priceAtPurchase.toString()
            }));

            await tx.sisyaTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: "PURCHASE",
                    status: "COMPLETED",
                    amount: totalCoins.negated(),
                    fee: new Decimal(0),
                    balanceBefore,
                    balanceAfter,
                    balanceType: "SPENDABLE",
                    metadata: {
                        reason: `Store order: ${itemsSummary}`,
                        orderId: newOrder.id,
                        items: itemsDetails,
                        expiryUsed: expiryUsed.toString(),
                        normalUsed: normalUsed.toString()
                    }
                }
            });

            return newOrder;
        });

        return res.json({
            success: true,
            data: order
        });
    } catch (error: any) {
        console.error("Error creating order:", error);

        // Handle transaction-specific errors
        if (error.message?.includes("Insufficient stock") || error.message?.includes("Insufficient balance")) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Get my orders
export async function getMyOrders(req: Request, res: Response) {
    try {
        const { page = 1, limit = 50 } = req.query;
        const { userId } = req.query;
        const role = req.role;

        if (role !== "user") {
            return res.status(403).json({
                success: false,
                message: "Only end users can access this"
            });
        }

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required in query params" });
        }

        const endUser = await prisma.endUsers.findFirst({
            where: {
                OR: [
                    { id: typeof userId === 'number' ? userId : parseInt(userId as string) || 0 },
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

        const { adminId } = req.body;
        if (!adminId) {
            return res.status(400).json({ success: false, message: "adminId is required in request body" });
        }

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

