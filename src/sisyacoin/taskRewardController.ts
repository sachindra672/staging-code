import { Request, Response } from "express";
import { prisma } from "../misc";
import { Decimal } from "@prisma/client/runtime/library";
import { applyTransaction, ensureWallet, getSystemWallet } from "../config/sisyacoinHelperFunctions";

/**
 * Grant task reward to a student
 * This should be called when a task (homework, test, quiz, etc.) is completed
 * Route: POST /sisyacoin/rewards/task
 */
export async function grantTaskReward(req: Request, res: Response) {
    try {
        const { userId, taskCode, coinsAmount, reason, expiresAt, metadata } = req.body;

        if (!userId || !taskCode || !coinsAmount) {
            return res.status(400).json({
                success: false,
                message: "userId, taskCode, and coinsAmount are required"
            });
        }

        const amountDecimal = new Decimal(coinsAmount);
        if (amountDecimal.lte(0)) {
            return res.status(400).json({ success: false, message: "coinsAmount must be positive" });
        }

        // Get system wallet
        const systemWallet = await getSystemWallet();

        // Check if system wallet has enough balance
        if (systemWallet.spendableBalance.lt(amountDecimal)) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance in system wallet",
                available: systemWallet.spendableBalance.toString(),
                required: amountDecimal.toString()
            });
        }

        // Get or create user wallet
        const wallet = await ensureWallet("ENDUSER", parseInt(userId));

        // Check if this task was already rewarded (using unique constraint)
        const existingReward = await prisma.sisyaReward.findUnique({
            where: {
                walletId_taskCode: {
                    walletId: wallet.id,
                    taskCode: taskCode
                }
            }
        });

        if (existingReward) {
            return res.status(400).json({
                success: false,
                message: "Task already rewarded for this user",
                data: existingReward
            });
        }

        // Update system wallet (decrease spendableBalance)
        const systemBalanceBefore = systemWallet.spendableBalance;
        const systemBalanceAfter = systemBalanceBefore.minus(amountDecimal);

        const updatedSystemWallet = await prisma.sisyaWallet.update({
            where: { id: systemWallet.id },
            data: {
                spendableBalance: systemBalanceAfter,
                totalSpent: systemWallet.totalSpent.plus(amountDecimal)
            }
        });

        // Update user wallet balance
        const userBalanceBefore = wallet.spendableBalance;
        let userBalanceAfter = userBalanceBefore.plus(amountDecimal);

        // If expiresAt is provided, create expiring balance instead of regular balance
        let expiryBalanceId: string | undefined;
        if (expiresAt) {
            const expiryDate = new Date(expiresAt);
            const expiryBalance = await prisma.sisyaExpiryBalance.create({
                data: {
                    walletId: wallet.id,
                    amountTotal: amountDecimal,
                    amountUsed: new Decimal(0),
                    amountExpired: new Decimal(0),
                    expiresAt: expiryDate,
                    reason: reason || `Task reward: ${taskCode}`,
                    isExpired: false
                }
            });
            expiryBalanceId = expiryBalance.id;
            // Don't add to spendableBalance if it's expiring
            userBalanceAfter = userBalanceBefore;
        } else {
            // Update wallet spendable balance
            await prisma.sisyaWallet.update({
                where: { id: wallet.id },
                data: {
                    spendableBalance: userBalanceAfter,
                    totalEarned: wallet.totalEarned.plus(amountDecimal)
                }
            });
        }

        // Create transactions for both wallets
        const systemTransaction = await applyTransaction(
            systemWallet.id,
            "TASK_REWARD",
            amountDecimal.negated(),
            "SPENDABLE",
            systemBalanceBefore,
            systemBalanceAfter,
            {
                reason: reason || `Task reward: ${taskCode}`,
                taskCode,
                toUserId: parseInt(userId)
            },
            wallet.id,
            undefined,
            "SYSTEM",
            undefined
        );

        const userTransaction = await applyTransaction(
            wallet.id,
            "TASK_REWARD",
            amountDecimal,
            "SPENDABLE",
            userBalanceBefore,
            userBalanceAfter,
            {
                reason: reason || `Task reward: ${taskCode}`,
                taskCode,
                expiresAt: expiresAt || null,
                expiryBalanceId: expiryBalanceId || null
            },
            systemWallet.id,
            undefined,
            "SYSTEM",
            undefined
        );

        // Create SisyaReward record
        const reward = await prisma.sisyaReward.create({
            data: {
                walletId: wallet.id,
                taskCode: taskCode,
                coinsEarned: amountDecimal,
                metadata: metadata || {
                    transactionId: userTransaction.id,
                    systemTransactionId: systemTransaction.id,
                    expiresAt: expiresAt || null
                }
            }
        });

        // Create audit logs for both wallets
        await Promise.all([
            prisma.sisyaAuditLog.create({
                data: {
                    walletId: systemWallet.id,
                    action: "TASK_REWARD_SENT",
                    actorType: "SYSTEM",
                    actorId: 0,
                    before: systemBalanceBefore,
                    delta: amountDecimal.negated(),
                    after: systemBalanceAfter,
                    note: `Task reward sent: ${taskCode} to user ${userId} - ${reason || ""}`
                }
            }),
            prisma.sisyaAuditLog.create({
                data: {
                    walletId: wallet.id,
                    action: "TASK_REWARD",
                    actorType: "SYSTEM",
                    actorId: 0,
                    before: userBalanceBefore,
                    delta: amountDecimal,
                    after: userBalanceAfter,
                    note: `Task reward received: ${taskCode} - ${reason || ""}`
                }
            })
        ]);

        return res.json({
            success: true,
            data: {
                reward,
                transactions: {
                    system: systemTransaction,
                    user: userTransaction
                },
                systemWallet: {
                    id: updatedSystemWallet.id,
                    spendableBalance: systemBalanceAfter
                },
                userWallet: {
                    id: wallet.id,
                    spendableBalance: userBalanceAfter,
                    totalEarned: wallet.totalEarned.plus(amountDecimal)
                }
            }
        });
    } catch (error: any) {
        console.error("Error granting task reward:", error);

        // Handle unique constraint violation (already rewarded)
        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                message: "Task already rewarded for this user"
            });
        }

        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

/**
 * Get all task rewards for a user
 * Route: GET /sisyacoin/rewards/task/me
 */
export async function getMyTaskRewards(req: Request, res: Response) {
    try {
        const { page = 1, limit = 50, taskCode } = req.query;
        const { id } = req.body;
        const role = req.role;

        if (!role) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!id) {
            return res.status(400).json({ success: false, message: "id is required in request body" });
        }

        let ownerId: number;
        if (role === "user") {
            const endUser = await prisma.endUsers.findFirst({
                where: {
                    OR: [
                        { id: typeof id === 'number' ? id : parseInt(id) || 0 },
                        { phone: typeof id === 'string' ? id : String(id) }
                    ]
                },
                select: { id: true }
            });
            if (!endUser) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            ownerId = endUser.id;
        } else {
            return res.status(403).json({ success: false, message: "Only end users can access this" });
        }

        const wallet = await prisma.sisyaWallet.findUnique({
            where: {
                ownerType_ownerId: {
                    ownerType: "ENDUSER",
                    ownerId: ownerId
                }
            }
        });

        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const skip = (pageNumber - 1) * pageSize;

        const where: any = {
            walletId: wallet.id
        };

        if (taskCode) {
            where.taskCode = taskCode;
        }

        const [rewards, total] = await Promise.all([
            prisma.sisyaReward.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" }
            }),
            prisma.sisyaReward.count({ where })
        ]);

        return res.json({
            success: true,
            data: rewards,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error("Error getting task rewards:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

/**
 * Check if a specific task was already rewarded for a user
 * Route: GET /sisyacoin/rewards/task/check
 */
export async function checkTaskReward(req: Request, res: Response) {
    try {
        const { userId, taskCode } = req.query;

        if (!userId || !taskCode) {
            return res.status(400).json({
                success: false,
                message: "userId and taskCode are required in query params"
            });
        }

        const wallet = await prisma.sisyaWallet.findUnique({
            where: {
                ownerType_ownerId: {
                    ownerType: "ENDUSER",
                    ownerId: parseInt(userId as string)
                }
            }
        });

        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        const reward = await prisma.sisyaReward.findUnique({
            where: {
                walletId_taskCode: {
                    walletId: wallet.id,
                    taskCode: taskCode as string
                }
            }
        });

        return res.json({
            success: true,
            data: {
                isRewarded: !!reward,
                reward: reward || null
            }
        });
    } catch (error) {
        console.error("Error checking task reward:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

/**
 * Admin: Get all task rewards (for analytics)
 * Route: GET /sisyacoin/admin/rewards/task
 */
export async function getAllTaskRewards(req: Request, res: Response) {
    try {
        const { page = 1, limit = 50, taskCode, userId } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const skip = (pageNumber - 1) * pageSize;

        const where: any = {};
        if (taskCode) {
            where.taskCode = taskCode;
        }
        if (userId) {
            const wallet = await prisma.sisyaWallet.findUnique({
                where: {
                    ownerType_ownerId: {
                        ownerType: "ENDUSER",
                        ownerId: parseInt(userId as string)
                    }
                }
            });
            if (wallet) {
                where.walletId = wallet.id;
            } else {
                // Return empty if wallet not found
                return res.json({
                    success: true,
                    data: [],
                    pagination: {
                        total: 0,
                        page: pageNumber,
                        limit: pageSize,
                        totalPages: 0
                    }
                });
            }
        }

        const [rewards, total] = await Promise.all([
            prisma.sisyaReward.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" },
                include: {
                    wallet: {
                        select: {
                            ownerType: true,
                            ownerId: true
                        }
                    }
                }
            }),
            prisma.sisyaReward.count({ where })
        ]);

        return res.json({
            success: true,
            data: rewards,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error("Error getting all task rewards:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

