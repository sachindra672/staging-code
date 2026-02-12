import { Request, Response } from "express";
import { prisma } from "../misc";
import { Decimal } from "@prisma/client/runtime/library";

export async function getAllStoreItemsAdmin(req: Request, res: Response) {
    try {
        const {
            page = 1,
            limit = 50,
            category,
            isActive,
            lowStock,
            search,
        } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);

        if (pageNumber <= 0 || pageSize <= 0) {
            return res.status(400).json({
                success: false,
                message: "Page and limit must be positive numbers",
            });
        }

        const skip = (pageNumber - 1) * pageSize;
        const where: any = {};

        if (category) where.category = category;
        if (isActive !== undefined) where.isActive = isActive === "true";
        if (lowStock === "true") where.stock = { lt: 10 };
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: "insensitive" } },
                { description: { contains: search as string, mode: "insensitive" } },
            ];
        }

        const [items, total] = await Promise.all([
            prisma.sisyaStoreItem.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" },
            }),
            prisma.sisyaStoreItem.count({ where }),
        ]);

        // Get order statistics for each item
        const itemsWithStats = await Promise.all(
            items.map(async (item) => {
                const orderItems = await prisma.sisyaStoreOrderItem.findMany({
                    where: { itemId: item.id },
                    include: {
                        order: {
                            select: {
                                status: true,
                            },
                        },
                    },
                });

                const completedOrders = orderItems.filter(
                    (oi) => oi.order.status === "COMPLETED"
                );
                const totalQuantitySold = completedOrders.reduce(
                    (sum, oi) => sum + oi.quantity,
                    0
                );
                const totalRevenue = completedOrders.reduce(
                    (sum, oi) => sum.plus(oi.priceAtPurchase.times(oi.quantity)),
                    new Decimal(0)
                );

                return {
                    ...item,
                    totalOrders: orderItems.length,
                    totalQuantitySold,
                    totalRevenue: totalRevenue.toString(),
                    averageOrderValue:
                        completedOrders.length > 0
                            ? totalRevenue.div(completedOrders.length).toString()
                            : "0",
                };
            })
        );

        return res.json({
            success: true,
            data: itemsWithStats,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (error) {
        console.error("Error getting all store items (admin):", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export async function getStoreItemByIdAdmin(req: Request, res: Response) {
    try {
        const { itemId } = req.params;

        const item = await prisma.sisyaStoreItem.findUnique({
            where: { id: itemId },
        });

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Store item not found",
            });
        }

        const orderItems = await prisma.sisyaStoreOrderItem.findMany({
            where: { itemId },
            include: {
                order: {
                    select: {
                        id: true,
                        status: true,
                        totalCoins: true,
                        createdAt: true,
                        wallet: {
                            select: {
                                ownerType: true,
                                ownerId: true,
                            },
                        },
                    },
                },
            },
        });

        const completedOrders = orderItems.filter(
            (oi) => oi.order.status === "COMPLETED"
        );
        const totalQuantitySold = completedOrders.reduce(
            (sum, oi) => sum + oi.quantity,
            0
        );
        const totalRevenue = completedOrders.reduce(
            (sum, oi) => sum.plus(oi.priceAtPurchase.times(oi.quantity)),
            new Decimal(0)
        );

        // Group by month
        const ordersByMonth: any = {};
        completedOrders.forEach((oi) => {
            const month = new Date(oi.order.createdAt).toISOString().slice(0, 7);
            if (!ordersByMonth[month]) {
                ordersByMonth[month] = { count: 0, revenue: new Decimal(0), quantity: 0 };
            }
            ordersByMonth[month].count++;
            ordersByMonth[month].revenue = ordersByMonth[month].revenue.plus(
                oi.priceAtPurchase.times(oi.quantity)
            );
            ordersByMonth[month].quantity += oi.quantity;
        });

        const ordersByMonthFormatted = Object.entries(ordersByMonth).map(
            ([month, data]: [string, any]) => ({
                month,
                orderCount: data.count,
                revenue: data.revenue.toString(),
                quantitySold: data.quantity,
            })
        );

        // Top buyers
        const buyerCount = new Map<string, number>();
        completedOrders.forEach((oi) => {
            const key = `${oi.order.wallet.ownerType}_${oi.order.wallet.ownerId}`;
            buyerCount.set(key, (buyerCount.get(key) || 0) + oi.quantity);
        });

        const topBuyers = Array.from(buyerCount.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([key, quantity]) => {
                const [ownerType, ownerId] = key.split("_");
                return { ownerType, ownerId: Number(ownerId), quantity };
            });

        return res.json({
            success: true,
            data: {
                item,
                statistics: {
                    totalOrders: orderItems.length,
                    totalQuantitySold,
                    totalRevenue: totalRevenue.toString(),
                    averageOrderValue:
                        completedOrders.length > 0
                            ? totalRevenue.div(completedOrders.length).toString()
                            : "0",
                    ordersByMonth: ordersByMonthFormatted,
                    topBuyers,
                },
            },
        });
    } catch (error) {
        console.error("Error getting store item (admin):", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export async function deleteStoreItemAdmin(req: Request, res: Response) {
    try {
        const { itemId } = req.params;

        const item = await prisma.sisyaStoreItem.findUnique({
            where: { id: itemId },
        });

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Store item not found",
            });
        }

        const newStatus = !item.isActive;

        const updatedItem = await prisma.sisyaStoreItem.update({
            where: { id: itemId },
            data: { isActive: newStatus },
        });

        return res.json({
            success: true,
            message: newStatus
                ? "Store item activated successfully"
                : "Store item deactivated successfully",
            data: updatedItem,
        });
    } catch (error) {
        console.error("Error deleting store item:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export async function bulkUpdateStock(req: Request, res: Response) {
    try {
        const { updates } = req.body;

        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "updates array is required",
            });
        }

        const results = await Promise.all(
            updates.map(async (update: { itemId: string; stock: number }) => {
                try {
                    const item = await prisma.sisyaStoreItem.update({
                        where: { id: update.itemId },
                        data: { stock: update.stock },
                    });
                    return { itemId: update.itemId, success: true, item };
                } catch (error) {
                    return {
                        itemId: update.itemId,
                        success: false,
                        error: error instanceof Error ? error.message : "Unknown error",
                    };
                }
            })
        );

        const successful = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success);

        return res.json({
            success: true,
            message: `Updated ${successful} items, ${failed.length} failed`,
            data: {
                successful,
                failed: failed.length,
                results,
            },
        });
    } catch (error) {
        console.error("Error bulk updating stock:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export async function getAllOrdersAdmin(req: Request, res: Response) {
    try {
        const {
            page = 1,
            limit = 50,
            status,
            ownerType,
            ownerId,
            from,
            to,
            search,
        } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);

        if (pageNumber <= 0 || pageSize <= 0) {
            return res.status(400).json({
                success: false,
                message: "Page and limit must be positive numbers",
            });
        }

        const skip = (pageNumber - 1) * pageSize;
        const where: any = {};

        if (status) where.status = status;

        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from as string);
            if (to) {
                const endDate = new Date(to as string);
                endDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = endDate;
            }
        }

        const [orders, total] = await Promise.all([
            prisma.sisyaStoreOrder.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" },
                include: {
                    wallet: {
                        select: {
                            id: true,
                            ownerType: true,
                            ownerId: true,
                        },
                    },
                    items: {
                        include: {
                            item: {
                                select: {
                                    id: true,
                                    name: true,
                                    imageUrl: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma.sisyaStoreOrder.count({ where }),
        ]);

        let filteredOrders = orders;
        if (ownerType || ownerId) {
            filteredOrders = orders.filter((order) => {
                if (ownerType && order.ownerType !== ownerType) return false;
                if (ownerId && order.ownerId !== Number(ownerId)) return false;
                return true;
            });
        }

        const enrichedOrders = await Promise.all(
            filteredOrders.map(async (order) => {
                let owner: any = null;

                if (order.ownerType === "ENDUSER") {
                    owner = await prisma.endUsers.findUnique({
                        where: { id: order.ownerId },
                        select: { id: true, name: true, email: true, phone: true },
                    });
                } else if (order.ownerType === "MENTOR") {
                    owner = await prisma.mentor.findUnique({
                        where: { id: order.ownerId },
                        select: { id: true, name: true, email: true },
                    });
                }

                if (search) {
                    const searchStr = (search as string).toLowerCase();
                    const matchesSearch =
                        order.id.toLowerCase().includes(searchStr) ||
                        owner?.name?.toLowerCase().includes(searchStr) ||
                        owner?.email?.toLowerCase().includes(searchStr);
                    if (!matchesSearch) return null;
                }

                return {
                    ...order,
                    owner,
                };
            })
        );

        const finalOrders = enrichedOrders.filter((o) => o !== null);

        return res.json({
            success: true,
            data: finalOrders,
            pagination: {
                total: search ? finalOrders.length : total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil((search ? finalOrders.length : total) / pageSize),
            },
        });
    } catch (error) {
        console.error("Error getting all orders (admin):", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export async function cancelOrderAdmin(req: Request, res: Response) {
    try {
        const { orderId } = req.params;
        const { reason, adminId } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: "reason is required",
            });
        }

        const order = await prisma.sisyaStoreOrder.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    include: {
                        item: true,
                    },
                },
            },
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        if (order.status === "CANCELLED") {
            return res.status(400).json({
                success: false,
                message: "Order is already cancelled",
            });
        }

        if (order.status === "REFUNDED") {
            return res.status(400).json({
                success: false,
                message: "Cannot cancel a refunded order",
            });
        }

        // If order was completed, refund the coins
        if (order.status === "COMPLETED") {
            const wallet = await prisma.sisyaWallet.findUnique({
                where: { id: order.walletId },
            });

            if (wallet) {
                const balanceBefore = wallet.spendableBalance;
                const balanceAfter = balanceBefore.plus(order.totalCoins);

                await prisma.sisyaWallet.update({
                    where: { id: wallet.id },
                    data: { spendableBalance: balanceAfter },
                });

                await prisma.sisyaTransaction.create({
                    data: {
                        walletId: wallet.id,
                        type: "PURCHASE_REFUND",
                        status: "COMPLETED",
                        amount: order.totalCoins,
                        fee: new Decimal(0),
                        balanceBefore,
                        balanceAfter,
                        balanceType: "SPENDABLE",
                        metadata: {
                            reason: `Order cancellation: ${reason}`,
                            orderId: order.id,
                        },
                    },
                });
            }

            // Restore stock
            for (const orderItem of order.items) {
                await prisma.sisyaStoreItem.update({
                    where: { id: orderItem.itemId },
                    data: {
                        stock: { increment: orderItem.quantity },
                    },
                });
            }
        }

        const updatedOrder = await prisma.sisyaStoreOrder.update({
            where: { id: orderId },
            data: {
                status: "CANCELLED",
                cancelledAt: new Date(),
                metadata: {
                    ...((order.metadata as any) || {}),
                    cancellationReason: reason,
                    cancelledBy: adminId || null,
                    cancelledAt: new Date().toISOString(),
                },
            },
            include: {
                items: {
                    include: {
                        item: true,
                    },
                },
            },
        });

        return res.json({
            success: true,
            message: "Order cancelled successfully",
            data: updatedOrder,
        });
    } catch (error) {
        console.error("Error cancelling order:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export async function updateOrderStatus(req: Request, res: Response) {
    try {
        const { orderId } = req.params;
        const { status, note } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "status is required",
            });
        }

        const validStatuses = ["PENDING", "COMPLETED", "REFUNDED", "CANCELLED"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
            });
        }

        const order = await prisma.sisyaStoreOrder.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        const updateData: any = { status };
        if (status === "COMPLETED" && !order.completedAt) {
            updateData.completedAt = new Date();
        }

        if (note) {
            updateData.metadata = {
                ...((order.metadata as any) || {}),
                adminNote: note,
                statusUpdatedAt: new Date().toISOString(),
            };
        }

        const updatedOrder = await prisma.sisyaStoreOrder.update({
            where: { id: orderId },
            data: updateData,
            include: {
                items: {
                    include: {
                        item: true,
                    },
                },
            },
        });

        return res.json({
            success: true,
            message: "Order status updated successfully",
            data: updatedOrder,
        });
    } catch (error) {
        console.error("Error updating order status:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export async function getOrderStats(req: Request, res: Response) {
    try {
        const { from, to } = req.query;

        const where: any = {};
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from as string);
            if (to) {
                const endDate = new Date(to as string);
                endDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = endDate;
            }
        }

        const orders = await prisma.sisyaStoreOrder.findMany({
            where,
            include: {
                items: {
                    include: {
                        item: true,
                    },
                },
            },
        });

        const completedOrders = orders.filter((o) => o.status === "COMPLETED");
        const totalRevenue = completedOrders.reduce(
            (sum, o) => sum.plus(o.totalCoins),
            new Decimal(0)
        );

        const byStatus: any = {};
        orders.forEach((o) => {
            byStatus[o.status] = (byStatus[o.status] || 0) + 1;
        });

        const byDay: any = {};
        orders.forEach((o) => {
            const day = new Date(o.createdAt).toISOString().split("T")[0];
            if (!byDay[day]) {
                byDay[day] = { count: 0, revenue: new Decimal(0) };
            }
            byDay[day].count++;
            if (o.status === "COMPLETED") {
                byDay[day].revenue = byDay[day].revenue.plus(o.totalCoins);
            }
        });

        const byDayFormatted = Object.entries(byDay)
            .map(([day, data]: [string, any]) => ({
                day,
                count: data.count,
                revenue: data.revenue.toString(),
            }))
            .sort((a, b) => a.day.localeCompare(b.day));

        // Top selling items
        const itemSales = new Map<string, { count: number; revenue: Decimal }>();
        completedOrders.forEach((o) => {
            o.items.forEach((oi) => {
                if (!itemSales.has(oi.itemId)) {
                    itemSales.set(oi.itemId, { count: 0, revenue: new Decimal(0) });
                }
                const sales = itemSales.get(oi.itemId)!;
                sales.count += oi.quantity;
                sales.revenue = sales.revenue.plus(oi.priceAtPurchase.times(oi.quantity));
            });
        });

        const topSellingItems = Array.from(itemSales.entries())
            .map(([itemId, data]) => ({ itemId, ...data }))
            .sort((a, b) => b.revenue.toNumber() - a.revenue.toNumber())
            .slice(0, 10)
            .map((item) => ({
                ...item,
                revenue: item.revenue.toString(),
            }));

        // Top customers
        const customerOrders = new Map<string, { count: number; total: Decimal }>();
        completedOrders.forEach((o) => {
            const key = `${o.ownerType}_${o.ownerId}`;
            if (!customerOrders.has(key)) {
                customerOrders.set(key, { count: 0, total: new Decimal(0) });
            }
            const customer = customerOrders.get(key)!;
            customer.count++;
            customer.total = customer.total.plus(o.totalCoins);
        });

        const topCustomers = Array.from(customerOrders.entries())
            .map(([key, data]) => {
                const [ownerType, ownerId] = key.split("_");
                return { ownerType, ownerId: Number(ownerId), ...data };
            })
            .sort((a, b) => b.total.toNumber() - a.total.toNumber())
            .slice(0, 10)
            .map((customer) => ({
                ...customer,
                total: customer.total.toString(),
            }));

        return res.json({
            success: true,
            data: {
                totalOrders: orders.length,
                totalRevenue: totalRevenue.toString(),
                averageOrderValue:
                    completedOrders.length > 0
                        ? totalRevenue.div(completedOrders.length).toString()
                        : "0",
                byStatus,
                byDay: byDayFormatted,
                topSellingItems,
                topCustomers,
            },
        });
    } catch (error) {
        console.error("Error getting order stats:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

