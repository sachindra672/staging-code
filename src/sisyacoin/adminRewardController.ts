import { Request, Response } from "express";
import { prisma } from "../misc";
import { Decimal } from "@prisma/client/runtime/library";

export async function getAllManualRewardsGivenAdmin(req: Request, res: Response) {
    try {
        const {
            page = 1,
            limit = 50,
            giverId,
            giverOwnerType,
            receiverId,
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

        // Get all manual rewards (they're stored in transactions with type MANUAL_REWARD)
        const where: any = {
            type: "MANUAL_REWARD",
        };

        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from as string);
            if (to) {
                const endDate = new Date(to as string);
                endDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = endDate;
            }
        }

        const [transactions, total] = await Promise.all([
            prisma.sisyaTransaction.findMany({
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
            prisma.sisyaTransaction.count({ where }),
        ]);

        // Filter and enrich with giver/receiver details
        const enrichedRewards = await Promise.all(
            transactions.map(async (tx) => {
                const metadata = tx.metadata as any;
                const receiverWalletId = tx.walletId;
                const giverWalletId = metadata?.fromWalletId;

                // Get receiver wallet and owner
                const receiverWallet = tx.wallet;
                let receiver: any = null;

                if (receiverWallet.ownerType === "ENDUSER") {
                    receiver = await prisma.endUsers.findUnique({
                        where: { id: receiverWallet.ownerId },
                        select: { id: true, name: true, email: true, phone: true },
                    });
                }

                // Get giver wallet and owner
                let giverWallet: any = null;
                let giver: any = null;

                if (giverWalletId) {
                    giverWallet = await prisma.sisyaWallet.findUnique({
                        where: { id: giverWalletId },
                        select: {
                            id: true,
                            ownerType: true,
                            ownerId: true,
                        },
                    });

                    if (giverWallet) {
                        if (giverWallet.ownerType === "MENTOR") {
                            giver = await prisma.mentor.findUnique({
                                where: { id: giverWallet.ownerId },
                                select: { id: true, name: true, email: true },
                            });
                        } else if (giverWallet.ownerType === "SALESMAN") {
                            // Handle salesman if needed
                            giver = { id: giverWallet.ownerId, name: "Salesman" };
                        }
                    }
                }

                // Filter by giver/receiver if provided
                if (giverId && giver?.id !== Number(giverId)) return null;
                if (giverOwnerType && giverWallet?.ownerType !== giverOwnerType) return null;
                if (receiverId && receiver?.id !== Number(receiverId)) return null;

                return {
                    id: tx.id,
                    giverWallet: giverWallet
                        ? {
                            ...giverWallet,
                            owner: giver,
                        }
                        : null,
                    receiverWallet: {
                        ...receiverWallet,
                        owner: receiver,
                    },
                    amount: tx.amount.abs().toString(),
                    reason: metadata?.reason || "",
                    taskCode: metadata?.taskCode || null,
                    createdAt: tx.createdAt,
                };
            })
        );

        const filteredRewards = enrichedRewards.filter((r) => r !== null);

        return res.json({
            success: true,
            data: filteredRewards,
            pagination: {
                total: filteredRewards.length,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(filteredRewards.length / pageSize),
            },
        });
    } catch (error) {
        console.error("Error getting all manual rewards given (admin):", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export async function getAllManualRewardsReceivedAdmin(req: Request, res: Response) {
    try {
        const {
            page = 1,
            limit = 50,
            receiverId,
            giverId,
            from,
            to,
        } = req.query;

        return getAllManualRewardsGivenAdmin(req, res);
    } catch (error) {
        console.error("Error getting all manual rewards received (admin):", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// Reward statistics
export async function getRewardStats(req: Request, res: Response) {
    try {
        const { from, to, type } = req.query;

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

        // Get task rewards
        let taskRewards: any[] = [];
        let manualRewards: any[] = [];

        if (!type || type === "TASK") {
            taskRewards = await prisma.sisyaReward.findMany({
                where: {
                    createdAt: where.createdAt || undefined,
                },
                include: {
                    wallet: {
                        select: {
                            ownerType: true,
                            ownerId: true,
                        },
                    },
                },
            });
        }

        if (!type || type === "MANUAL") {
            const manualTransactions = await prisma.sisyaTransaction.findMany({
                where: {
                    ...where,
                    type: "MANUAL_REWARD",
                    status: "COMPLETED",
                },
                include: {
                    wallet: {
                        select: {
                            ownerType: true,
                            ownerId: true,
                        },
                    },
                },
            });

            manualRewards = manualTransactions.map((tx) => ({
                wallet: tx.wallet,
                coinsEarned: tx.amount.abs(),
                metadata: tx.metadata,
                createdAt: tx.createdAt,
            }));
        }

        // Calculate totals
        const totalTaskRewards = taskRewards.length;
        const totalTaskCoins = taskRewards.reduce(
            (sum, r) => sum.plus(r.coinsEarned),
            new Decimal(0)
        );

        const totalManualRewards = manualRewards.length;
        const totalManualCoins = manualRewards.reduce(
            (sum, r) => sum.plus(r.coinsEarned),
            new Decimal(0)
        );

        // Group by task code
        const byTaskCode: any = {};
        taskRewards.forEach((r) => {
            const taskCode = r.taskCode || "UNKNOWN";
            const prefix = taskCode.split("_")[0];
            if (!byTaskCode[prefix]) {
                byTaskCode[prefix] = { count: 0, amount: new Decimal(0) };
            }
            byTaskCode[prefix].count++;
            byTaskCode[prefix].amount = byTaskCode[prefix].amount.plus(r.coinsEarned);
        });

        const byTaskCodeFormatted: any = {};
        Object.keys(byTaskCode).forEach((key) => {
            byTaskCodeFormatted[key] = {
                count: byTaskCode[key].count,
                amount: byTaskCode[key].amount.toString(),
            };
        });

        // Top reward givers (for manual rewards)
        const giverCount = new Map<string, { count: number; amount: Decimal }>();
        manualRewards.forEach((r) => {
            const metadata = r.metadata as any;
            const giverWalletId = metadata?.fromWalletId;
            if (giverWalletId) {
                if (!giverCount.has(giverWalletId)) {
                    giverCount.set(giverWalletId, { count: 0, amount: new Decimal(0) });
                }
                const giver = giverCount.get(giverWalletId)!;
                giver.count++;
                giver.amount = giver.amount.plus(r.coinsEarned);
            }
        });

        const topRewardGivers = Array.from(giverCount.entries())
            .map(([walletId, data]) => ({ walletId, ...data }))
            .sort((a, b) => b.amount.toNumber() - a.amount.toNumber())
            .slice(0, 10)
            .map((giver) => ({
                ...giver,
                amount: giver.amount.toString(),
            }));

        // Top reward receivers
        const receiverCount = new Map<string, { count: number; amount: Decimal }>();
        [...taskRewards, ...manualRewards].forEach((r) => {
            const key = `${r.wallet.ownerType}_${r.wallet.ownerId}`;
            if (!receiverCount.has(key)) {
                receiverCount.set(key, { count: 0, amount: new Decimal(0) });
            }
            const receiver = receiverCount.get(key)!;
            receiver.count++;
            receiver.amount = receiver.amount.plus(r.coinsEarned);
        });

        const topRewardReceivers = Array.from(receiverCount.entries())
            .map(([key, data]) => {
                const [ownerType, ownerId] = key.split("_");
                return { ownerType, ownerId: Number(ownerId), ...data };
            })
            .sort((a, b) => b.amount.toNumber() - a.amount.toNumber())
            .slice(0, 10)
            .map((receiver) => ({
                ...receiver,
                amount: receiver.amount.toString(),
            }));

        // Group by day
        const byDay: any = {};
        [...taskRewards, ...manualRewards].forEach((r) => {
            const day = new Date(r.createdAt).toISOString().split("T")[0];
            if (!byDay[day]) {
                byDay[day] = { count: 0, amount: new Decimal(0) };
            }
            byDay[day].count++;
            byDay[day].amount = byDay[day].amount.plus(r.coinsEarned);
        });

        const byDayFormatted = Object.entries(byDay)
            .map(([day, data]: [string, any]) => ({
                day,
                count: data.count,
                amount: data.amount.toString(),
            }))
            .sort((a, b) => a.day.localeCompare(b.day));

        return res.json({
            success: true,
            data: {
                totalRewards: totalTaskRewards + totalManualRewards,
                totalCoinsGiven: totalTaskCoins.plus(totalManualCoins).toString(),
                byType: {
                    TASK: {
                        count: totalTaskRewards,
                        amount: totalTaskCoins.toString(),
                    },
                    MANUAL: {
                        count: totalManualRewards,
                        amount: totalManualCoins.toString(),
                    },
                },
                byTaskCode: byTaskCodeFormatted,
                topRewardGivers,
                topRewardReceivers,
                byDay: byDayFormatted,
            },
        });
    } catch (error) {
        console.error("Error getting reward stats:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// Get reward budget allocations
export async function getRewardBudgetAllocations(req: Request, res: Response) {
    try {
        const {
            page = 1,
            limit = 50,
            toOwnerType,
            toOwnerId,
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
        const where: any = {
            type: "MANUAL_REWARD_BUDGET",
        };

        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from as string);
            if (to) {
                const endDate = new Date(to as string);
                endDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = endDate;
            }
        }

        const [transactions, total] = await Promise.all([
            prisma.sisyaTransaction.findMany({
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
            prisma.sisyaTransaction.count({ where }),
        ]);

        const enrichedAllocations = await Promise.all(
            transactions.map(async (tx) => {
                const metadata = tx.metadata as any;
                const toWalletId = tx.walletId;
                const toWallet = tx.wallet;

                let owner: any = null;
                if (toWallet.ownerType === "MENTOR") {
                    owner = await prisma.mentor.findUnique({
                        where: { id: toWallet.ownerId },
                        select: { id: true, name: true, email: true },
                    });
                }

                // Filter
                if (toOwnerType && toWallet.ownerType !== toOwnerType) return null;
                if (toOwnerId && toWallet.ownerId !== Number(toOwnerId)) return null;

                // Get current wallet balance
                const currentWallet = await prisma.sisyaWallet.findUnique({
                    where: { id: toWalletId },
                    select: {
                        rewardBudget: true,
                    },
                });

                return {
                    id: tx.id,
                    toWallet: {
                        ...toWallet,
                        owner,
                        currentRewardBudget: currentWallet?.rewardBudget.toString() || "0",
                    },
                    amount: tx.amount.abs().toString(),
                    reason: metadata?.reason || "",
                    allocatedBy: metadata?.adminId || null,
                    createdAt: tx.createdAt,
                };
            })
        );

        const filteredAllocations = enrichedAllocations.filter((a) => a !== null);

        return res.json({
            success: true,
            data: filteredAllocations,
            pagination: {
                total: filteredAllocations.length,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(filteredAllocations.length / pageSize),
            },
        });
    } catch (error) {
        console.error("Error getting reward budget allocations:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// Get reward budget usage
export async function getRewardBudgetUsage(req: Request, res: Response) {
    try {
        const { ownerType, ownerId, from, to } = req.query;

        const where: any = {};
        if (ownerType) where.ownerType = ownerType;
        if (ownerId) where.ownerId = Number(ownerId);

        const wallets = await prisma.sisyaWallet.findMany({
            where,
            select: {
                id: true,
                ownerType: true,
                ownerId: true,
                rewardBudget: true,
            },
        });

        const usageData = await Promise.all(
            wallets.map(async (wallet) => {
                // Get all allocations (budget given)
                const allocations = await prisma.sisyaTransaction.findMany({
                    where: {
                        counterpartyWalletId: wallet.id,
                        type: "MANUAL_REWARD_BUDGET",
                        status: "COMPLETED",
                        createdAt: from || to
                            ? {
                                gte: from ? new Date(from as string) : undefined,
                                lte: to
                                    ? (() => {
                                        const d = new Date(to as string);
                                        d.setHours(23, 59, 59, 999);
                                        return d;
                                    })()
                                    : undefined,
                            }
                            : undefined,
                    },
                });

                const totalAllocated = allocations.reduce(
                    (sum, tx) => sum.plus(tx.amount.abs()),
                    new Decimal(0)
                );

                // Get all rewards given (budget used)
                const rewardsGiven = await prisma.sisyaTransaction.findMany({
                    where: {
                        walletId: wallet.id,
                        type: "MANUAL_REWARD",
                        status: "COMPLETED",
                        createdAt: from || to
                            ? {
                                gte: from ? new Date(from as string) : undefined,
                                lte: to
                                    ? (() => {
                                        const d = new Date(to as string);
                                        d.setHours(23, 59, 59, 999);
                                        return d;
                                    })()
                                    : undefined,
                            }
                            : undefined,
                    },
                });

                const totalUsed = rewardsGiven.reduce(
                    (sum, tx) => sum.plus(tx.amount.abs()),
                    new Decimal(0)
                );

                // Get owner details
                let owner: any = null;
                if (wallet.ownerType === "MENTOR") {
                    owner = await prisma.mentor.findUnique({
                        where: { id: wallet.ownerId },
                        select: { id: true, name: true, email: true },
                    });
                }

                const lastReward = rewardsGiven.sort(
                    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
                )[0];

                return {
                    wallet: {
                        ...wallet,
                        owner,
                    },
                    totalAllocated: totalAllocated.toString(),
                    totalUsed: totalUsed.toString(),
                    remaining: wallet.rewardBudget.toString(),
                    usagePercentage:
                        totalAllocated.gt(0)
                            ? totalUsed.div(totalAllocated).times(100).toNumber()
                            : 0,
                    rewardsGiven: rewardsGiven.length,
                    lastRewardGiven: lastReward?.createdAt || null,
                };
            })
        );

        return res.json({
            success: true,
            data: usageData,
        });
    } catch (error) {
        console.error("Error getting reward budget usage:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export async function getAllUserRewardLimitsAdmin(req: Request, res: Response) {
    try {
        const { walletId, userId } = req.query;

        const where: any = {};
        if (walletId) where.walletId = walletId;

        let limits = await prisma.sisyaRewardLimitUser.findMany({
            where,
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

        if (userId) {
            const wallet = await prisma.sisyaWallet.findUnique({
                where: {
                    ownerType_ownerId: {
                        ownerType: "ENDUSER",
                        ownerId: Number(userId),
                    },
                },
            });

            if (wallet) {
                limits = limits.filter((l) => l.walletId === wallet.id);
            }
        }

        // Enrich with owner details
        const enrichedLimits = await Promise.all(
            limits.map(async (limit) => {
                let owner: any = null;
                if (limit.wallet.ownerType === "ENDUSER") {
                    owner = await prisma.endUsers.findUnique({
                        where: { id: limit.wallet.ownerId },
                        select: { id: true, name: true, email: true },
                    });
                }

                return {
                    ...limit,
                    wallet: {
                        ...limit.wallet,
                        owner,
                    },
                };
            })
        );

        return res.json({
            success: true,
            data: enrichedLimits,
        });
    } catch (error) {
        console.error("Error getting user reward limits:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

// Get reward usage statistics
export async function getRewardUsageStats(req: Request, res: Response) {
    try {
        const { from, to, ownerType, ownerId } = req.query;

        const where: any = {
            type: { in: ["MANUAL_REWARD", "TASK_REWARD"] },
            status: "COMPLETED",
        };

        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from as string);
            if (to) {
                const endDate = new Date(to as string);
                endDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = endDate;
            }
        }

        const transactions = await prisma.sisyaTransaction.findMany({
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

        // Filter by owner if provided
        let filteredTransactions = transactions;
        if (ownerType) {
            filteredTransactions = filteredTransactions.filter(
                (tx) => tx.wallet.ownerType === ownerType
            );
        }
        if (ownerId) {
            filteredTransactions = filteredTransactions.filter(
                (tx) => tx.wallet.ownerId === Number(ownerId)
            );
        }

        const totalRewards = filteredTransactions.length;
        const totalCoins = filteredTransactions.reduce(
            (sum, tx) => sum.plus(tx.amount.abs()),
            new Decimal(0)
        );

        // Group by day
        const byDay: any = {};
        filteredTransactions.forEach((tx) => {
            const day = new Date(tx.createdAt).toISOString().split("T")[0];
            if (!byDay[day]) {
                byDay[day] = { count: 0, amount: new Decimal(0) };
            }
            byDay[day].count++;
            byDay[day].amount = byDay[day].amount.plus(tx.amount.abs());
        });

        const byDayFormatted = Object.entries(byDay)
            .map(([day, data]: [string, any]) => ({
                day,
                count: data.count,
                amount: data.amount.toString(),
            }))
            .sort((a, b) => a.day.localeCompare(b.day));

        // Limit violations would require checking against limits
        // This is a simplified version
        const limitViolations: any[] = [];

        return res.json({
            success: true,
            data: {
                totalRewardsGiven: totalRewards,
                totalCoins: totalCoins.toString(),
                averagePerReward:
                    totalRewards > 0 ? totalCoins.div(totalRewards).toString() : "0",
                byDay: byDayFormatted,
                limitViolations,
            },
        });
    } catch (error) {
        console.error("Error getting reward usage stats:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

