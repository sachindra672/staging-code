import { Request, Response } from "express";
import { prisma } from "../misc";
import { Decimal } from "@prisma/client/runtime/library";


export async function getAllTransactionsAdmin(req: Request, res: Response) {
    try {
        const {
            page = 1,
            limit = 50,
            type,
            status,
            ownerType,
            ownerId,
            walletId,
            from,
            to,
            search
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

        if (type) where.type = type;
        if (status) where.status = status;
        if (walletId) where.walletId = walletId;

        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from as string);
            if (to) {
                const endDate = new Date(to as string);
                endDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = endDate;
            }
        }

        // Build query with wallet and owner relations
        const transactionsQuery = prisma.sisyaTransaction.findMany({
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
            },
        });

        const countQuery = prisma.sisyaTransaction.count({ where });

        let [transactions, total] = await Promise.all([transactionsQuery, countQuery]);

        // Filter by ownerType and ownerId if provided
        if (ownerType || ownerId) {
            transactions = transactions.filter((tx) => {
                if (ownerType && tx.wallet.ownerType !== ownerType) return false;
                if (ownerId && tx.wallet.ownerId !== Number(ownerId)) return false;
                return true;
            });

            // Re-count after filtering
            if (ownerType || ownerId) {
                const allMatching = await prisma.sisyaTransaction.findMany({
                    where,
                    include: {
                        wallet: {
                            select: {
                                ownerType: true,
                                ownerId: true,
                            },
                        },
                    },
                });

                total = allMatching.filter((tx) => {
                    if (ownerType && tx.wallet.ownerType !== ownerType) return false;
                    if (ownerId && tx.wallet.ownerId !== Number(ownerId)) return false;
                    return true;
                }).length;
            }
        }

        // Search in metadata if provided
        if (search) {
            const searchStr = (search as string).toLowerCase();
            transactions = transactions.filter((tx) => {
                const metadata = tx.metadata as any;
                const reason = metadata?.reason?.toLowerCase() || "";
                return reason.includes(searchStr);
            });
        }

        // Fetch owner details for each transaction
        const enrichedTransactions = await Promise.all(
            transactions.map(async (tx) => {
                let owner: any = null;

                if (tx.wallet.ownerType === "ENDUSER") {
                    owner = await prisma.endUsers.findUnique({
                        where: { id: tx.wallet.ownerId },
                        select: { id: true, name: true, email: true, phone: true },
                    });
                } else if (tx.wallet.ownerType === "MENTOR") {
                    owner = await prisma.mentor.findUnique({
                        where: { id: tx.wallet.ownerId },
                        select: { id: true, name: true, email: true },
                    });
                } else if (tx.wallet.ownerType === "ADMIN") {
                    owner = await prisma.admin.findUnique({
                        where: { id: tx.wallet.ownerId },
                        select: { id: true, name: true, email: true },
                    });
                } else if (tx.wallet.ownerType === "SUBADMIN") {
                    // Note: SubAdmin uses String ID, so this might not match wallet ownerId (Int)
                    // For now, we'll try to handle it gracefully
                    owner = { id: tx.wallet.ownerId, name: "SubAdmin", email: null };
                }

                return {
                    ...tx,
                    wallet: {
                        ...tx.wallet,
                        owner,
                    },
                };
            })
        );

        return res.json({
            success: true,
            data: enrichedTransactions,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (error) {
        console.error("Error getting all transactions (admin):", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// Transaction Analytics
export async function getTransactionAnalytics(req: Request, res: Response) {
    try {
        const { from, to, groupBy = "day" } = req.query;

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                message: "from and to dates are required",
            });
        }

        const startDate = new Date(from as string);
        const endDate = new Date(to as string);
        endDate.setHours(23, 59, 59, 999);

        const where = {
            createdAt: {
                gte: startDate,
                lte: endDate,
            },
            status: "COMPLETED" as const,
        };

        // Get all transactions in date range
        const transactions = await prisma.sisyaTransaction.findMany({
            where,
            select: {
                type: true,
                amount: true,
                createdAt: true,
            },
        });

        // Calculate totals
        const totalVolume = transactions.reduce(
            (sum, tx) => sum.plus(tx.amount.abs()),
            new Decimal(0)
        );

        // Group by type
        const byType: any = {};
        transactions.forEach((tx) => {
            if (!byType[tx.type]) {
                byType[tx.type] = { count: 0, volume: new Decimal(0) };
            }
            byType[tx.type].count++;
            byType[tx.type].volume = byType[tx.type].volume.plus(tx.amount.abs());
        });

        // Convert to strings for JSON
        const byTypeFormatted: any = {};
        Object.keys(byType).forEach((key) => {
            byTypeFormatted[key] = {
                count: byType[key].count,
                volume: byType[key].volume.toString(),
            };
        });

        // Group by day/week/month
        const byTimePeriod: any[] = [];
        const periodMap = new Map<string, { count: number; volume: Decimal }>();

        transactions.forEach((tx) => {
            const date = new Date(tx.createdAt);
            let key = "";

            if (groupBy === "day") {
                key = date.toISOString().split("T")[0];
            } else if (groupBy === "week") {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                key = weekStart.toISOString().split("T")[0];
            } else if (groupBy === "month") {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            }

            if (!periodMap.has(key)) {
                periodMap.set(key, { count: 0, volume: new Decimal(0) });
            }

            const period = periodMap.get(key)!;
            period.count++;
            period.volume = period.volume.plus(tx.amount.abs());
        });

        periodMap.forEach((value, key) => {
            byTimePeriod.push({
                period: key,
                count: value.count,
                volume: value.volume.toString(),
            });
        });

        byTimePeriod.sort((a, b) => a.period.localeCompare(b.period));

        // Note: Top users calculation can be added if needed
        // It would require joining transactions with wallets and then with owners

        return res.json({
            success: true,
            data: {
                totalVolume: totalVolume.toString(),
                transactionCount: transactions.length,
                byType: byTypeFormatted,
                byTimePeriod,
            },
        });
    } catch (error) {
        console.error("Error getting transaction analytics:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// ============================================
// AUDIT LOGS MANAGEMENT
// ============================================

// Get all audit logs (Admin)
export async function getAllAuditLogsAdmin(req: Request, res: Response) {
    try {
        const {
            page = 1,
            limit = 50,
            action,
            actorType,
            actorId,
            walletId,
            from,
            to,
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

        if (action) where.action = action;
        if (actorType) where.actorType = actorType;
        if (actorId) where.actorId = Number(actorId);
        if (walletId) where.walletId = walletId;

        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from as string);
            if (to) {
                const endDate = new Date(to as string);
                endDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = endDate;
            }
        }

        const [logs, total] = await Promise.all([
            prisma.sisyaAuditLog.findMany({
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
                },
            }),
            prisma.sisyaAuditLog.count({ where }),
        ]);

        // Enrich with actor details
        const enrichedLogs = await Promise.all(
            logs.map(async (log) => {
                let actor: any = null;

                if (log.actorType === "ADMIN" || log.actorType === "SUBADMIN") {
                    actor = await prisma.admin.findUnique({
                        where: { id: log.actorId },
                        select: { id: true, name: true, email: true },
                    });
                } else if (log.actorType === "MENTOR") {
                    actor = await prisma.mentor.findUnique({
                        where: { id: log.actorId },
                        select: { id: true, name: true, email: true },
                    });
                }

                return {
                    ...log,
                    actor,
                };
            })
        );

        return res.json({
            success: true,
            data: enrichedLogs,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (error) {
        console.error("Error getting audit logs (admin):", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// Get audit log by ID
export async function getAuditLogById(req: Request, res: Response) {
    try {
        const { logId } = req.params;

        const log = await prisma.sisyaAuditLog.findUnique({
            where: { id: logId },
            include: {
                wallet: {
                    select: {
                        id: true,
                        ownerType: true,
                        ownerId: true,
                    },
                },
            },
        });

        if (!log) {
            return res.status(404).json({
                success: false,
                message: "Audit log not found",
            });
        }

        // Get actor details
        let actor: any = null;
        if (log.actorType === "ADMIN") {
            actor = await prisma.admin.findUnique({
                where: { id: log.actorId },
                select: { id: true, name: true, email: true },
            });
        } else if (log.actorType === "SUBADMIN") {
            // SubAdmin might need different handling due to String ID type
            actor = { id: log.actorId, name: "SubAdmin", email: null };
        } else if (log.actorType === "MENTOR") {
            actor = await prisma.mentor.findUnique({
                where: { id: log.actorId },
                select: { id: true, name: true, email: true },
            });
        }

        return res.json({
            success: true,
            data: {
                ...log,
                actor,
            },
        });
    } catch (error) {
        console.error("Error getting audit log:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// Audit log statistics
export async function getAuditLogStats(req: Request, res: Response) {
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

        const logs = await prisma.sisyaAuditLog.findMany({
            where,
            select: {
                action: true,
                actorType: true,
                actorId: true,
            },
        });

        // Count by action
        const byAction: any = {};
        logs.forEach((log) => {
            byAction[log.action] = (byAction[log.action] || 0) + 1;
        });

        // Count by actor type
        const byActorType: any = {};
        logs.forEach((log) => {
            byActorType[log.actorType] = (byActorType[log.actorType] || 0) + 1;
        });

        // Count by actor ID
        const byActorId: any = {};
        logs.forEach((log) => {
            const key = `${log.actorType}_${log.actorId}`;
            byActorId[key] = (byActorId[key] || 0) + 1;
        });

        // Get top admins
        const topAdmins: any[] = [];
        Object.entries(byActorId)
            .filter(([key]) => key.startsWith("ADMIN_"))
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 10)
            .forEach(([key, count]) => {
                const actorId = Number(key.split("_")[1]);
                topAdmins.push({ actorId, actionCount: count });
            });

        // Enrich with admin names
        const enrichedTopAdmins = await Promise.all(
            topAdmins.map(async (admin) => {
                const adminRecord = await prisma.admin.findUnique({
                    where: { id: admin.actorId },
                    select: { id: true, name: true, email: true },
                });
                return {
                    ...admin,
                    name: adminRecord?.name || "Unknown",
                    email: adminRecord?.email || null,
                };
            })
        );

        return res.json({
            success: true,
            data: {
                totalActions: logs.length,
                byAction,
                byActorType,
                topAdmins: enrichedTopAdmins,
            },
        });
    } catch (error) {
        console.error("Error getting audit log stats:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

