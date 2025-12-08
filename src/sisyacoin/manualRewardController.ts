import { Request, Response } from "express";
import { prisma } from "../misc";
import { Decimal } from "@prisma/client/runtime/library";
import { applyTransaction, checkRewardLimits, ensureWallet, updateRewardUsage } from "../config/sisyacoinHelperFunctions";

// Give manual reward to end user
// middelware mentor, subadmin
export async function grantManualReward(req: Request, res: Response) {
    try {
        const { toUserId, amount, reason, taskCode, campaignCode } = req.body;

        if (!toUserId || !amount) {
            return res.status(400).json({
                success: false,
                message: "toUserId and amount are required"
            });
        }

        const amountDecimal = new Decimal(amount);
        if (amountDecimal.lte(0)) {
            return res.status(400).json({ success: false, message: "Amount must be positive" });
        }

        // user ko middleware se lo
        const giverUser = req.user;
        const giverRole = req.role;

        if (giverRole !== "mentor" && giverRole !== "subadmin") {
            return res.status(403).json({
                success: false,
                message: "Only mentors and salesmen can grant manual rewards"
            });
        }

        // Get giver's ID and wallet
        let giverOwnerType: "MENTOR" | "SALESMAN";
        let giverOwnerId: number;

        if (giverRole === "mentor") {
            giverOwnerType = "MENTOR";
            const mentorId = giverUser?.user || giverUser?.id || giverUser?.selfId;
            if (!mentorId) {
                return res.status(400).json({ success: false, message: "Mentor ID not found in token" });
            }
            giverOwnerId = typeof mentorId === 'number' ? mentorId : parseInt(mentorId) || 0;
        } else {
            // subadmin ke liye check karna padega ki mentor h ki salesman, assume mentor
            giverOwnerType = "MENTOR";
            const adminId = giverUser?.user || giverUser?.id || giverUser?.selfId;
            if (!adminId) {
                return res.status(400).json({ success: false, message: "Admin ID not found in token" });
            }
            giverOwnerId = typeof adminId === 'number' ? adminId : parseInt(adminId) || 0;
        }

        const giverWallet = await ensureWallet(giverOwnerType, giverOwnerId);

        // Check if giver has enough reward budget
        if (giverWallet.rewardBudget.lt(amountDecimal)) {
            return res.status(400).json({
                success: false,
                message: "Insufficient reward budget"
            });
        }

        // Check reward limits
        const limitCheck = await checkRewardLimits(giverWallet.id, amountDecimal, giverOwnerType);
        if (!limitCheck.allowed) {
            return res.status(400).json({
                success: false,
                message: limitCheck.reason || "Reward limit exceeded",
                limitInfo: {
                    dailyLimit: limitCheck.dailyLimit.toString(),
                    monthlyLimit: limitCheck.monthlyLimit?.toString() || null,
                    todayUsage: limitCheck.todayUsage.toString(),
                    monthUsage: limitCheck.monthUsage.toString()
                }
            });
        }

        // Get or create receiver wallet (end user)
        const receiverWallet = await ensureWallet("ENDUSER", parseInt(toUserId));

        // Update giver wallet (decrease rewardBudget)
        const giverBalanceBefore = giverWallet.rewardBudget;
        const giverBalanceAfter = giverBalanceBefore.minus(amountDecimal);

        const updatedGiverWallet = await prisma.sisyaWallet.update({
            where: { id: giverWallet.id },
            data: {
                rewardBudget: giverBalanceAfter
            }
        });

        // Update receiver wallet (increase spendableBalance)
        const receiverBalanceBefore = receiverWallet.spendableBalance;
        const receiverBalanceAfter = receiverBalanceBefore.plus(amountDecimal);

        const updatedReceiverWallet = await prisma.sisyaWallet.update({
            where: { id: receiverWallet.id },
            data: {
                spendableBalance: receiverBalanceAfter,
                totalEarned: receiverWallet.totalEarned.plus(amountDecimal)
            }
        });

        // Create transactions
        const giverTransaction = await applyTransaction(
            giverWallet.id,
            "MANUAL_REWARD",
            amountDecimal.negated(),
            "REWARD_BUDGET",
            giverBalanceBefore,
            giverBalanceAfter,
            {
                reason: reason || "Manual reward given",
                toUserId: parseInt(toUserId),
                taskCode,
                campaignCode
            },
            receiverWallet.id,
            undefined,
            giverOwnerType,
            giverOwnerId
        );

        const receiverTransaction = await applyTransaction(
            receiverWallet.id,
            "MANUAL_REWARD",
            amountDecimal,
            "SPENDABLE",
            receiverBalanceBefore,
            receiverBalanceAfter,
            {
                reason: reason || "Manual reward received",
                fromOwnerType: giverOwnerType,
                fromOwnerId: giverOwnerId,
                taskCode,
                campaignCode
            },
            giverWallet.id,
            undefined,
            giverOwnerType,
            giverOwnerId
        );

        // Update reward usage tracking
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await updateRewardUsage(giverWallet.id, amountDecimal, today);

        // Create audit logs
        await Promise.all([
            prisma.sisyaAuditLog.create({
                data: {
                    walletId: giverWallet.id,
                    action: "GRANT_MANUAL_REWARD",
                    actorType: giverOwnerType,
                    actorId: giverOwnerId,
                    before: giverBalanceBefore,
                    delta: amountDecimal.negated(),
                    after: giverBalanceAfter,
                    note: `Granted ${amount} to endUser ${toUserId}: ${reason || ""}`
                }
            }),
            prisma.sisyaAuditLog.create({
                data: {
                    walletId: receiverWallet.id,
                    action: "RECEIVE_MANUAL_REWARD",
                    actorType: giverOwnerType,
                    actorId: giverOwnerId,
                    before: receiverBalanceBefore,
                    delta: amountDecimal,
                    after: receiverBalanceAfter,
                    note: `Received ${amount} from ${giverOwnerType} ${giverOwnerId}: ${reason || ""}`
                }
            })
        ]);

        return res.json({
            success: true,
            data: {
                giverWallet: updatedGiverWallet,
                receiverWallet: updatedReceiverWallet,
                transactions: {
                    giver: giverTransaction,
                    receiver: receiverTransaction
                }
            }
        });
    } catch (error) {
        console.error("Error granting manual reward:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Mentor or saleman ka history of rewards given by me
export async function getRewardsGiven(req: Request, res: Response) {
    try {
        const { page = 1, limit = 50 } = req.query;
        const giverUser = req.user;
        const giverRole = req.role;

        if (giverRole !== "mentor" && giverRole !== "subadmin") {
            return res.status(403).json({
                success: false,
                message: "Only mentors and salesmen can access this"
            });
        }

        let giverOwnerType: "MENTOR" | "SALESMAN";
        let giverOwnerId: number;

        if (giverRole === "mentor") {
            giverOwnerType = "MENTOR";
            const mentorId = giverUser?.user || giverUser?.id || giverUser?.selfId;
            if (!mentorId) {
                return res.status(400).json({ success: false, message: "Mentor ID not found" });
            }
            giverOwnerId = typeof mentorId === 'number' ? mentorId : parseInt(mentorId) || 0;
        } else {
            giverOwnerType = "MENTOR"; // Assuming subadmin acts as mentor
            const adminId = giverUser?.user || giverUser?.id || giverUser?.selfId;
            if (!adminId) {
                return res.status(400).json({ success: false, message: "Admin ID not found" });
            }
            giverOwnerId = typeof adminId === 'number' ? adminId : parseInt(adminId) || 0;
        }

        const wallet = await prisma.sisyaWallet.findUnique({
            where: {
                ownerType_ownerId: {
                    ownerType: giverOwnerType,
                    ownerId: giverOwnerId
                }
            }
        });

        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const skip = (pageNumber - 1) * pageSize;

        const [transactions, total] = await Promise.all([
            prisma.sisyaTransaction.findMany({
                where: {
                    walletId: wallet.id,
                    type: "MANUAL_REWARD",
                    balanceType: "REWARD_BUDGET"
                },
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
            prisma.sisyaTransaction.count({
                where: {
                    walletId: wallet.id,
                    type: "MANUAL_REWARD",
                    balanceType: "REWARD_BUDGET"
                }
            })
        ]);

        return res.json({
            success: true,
            data: transactions,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error("Error getting rewards given:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// End user ko jo jo manual reward mila h
export async function getRewardsReceived(req: Request, res: Response) {
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

        // Find endUser by phone or id
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

        const [transactions, total] = await Promise.all([
            prisma.sisyaTransaction.findMany({
                where: {
                    walletId: wallet.id,
                    type: "MANUAL_REWARD",
                    balanceType: "SPENDABLE"
                },
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
            prisma.sisyaTransaction.count({
                where: {
                    walletId: wallet.id,
                    type: "MANUAL_REWARD",
                    balanceType: "SPENDABLE"
                }
            })
        ]);

        return res.json({
            success: true,
            data: transactions,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error("Error getting rewards received:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

