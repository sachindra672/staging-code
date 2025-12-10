import { Request, Response } from "express";
import { prisma } from "../misc";
import { Decimal } from "@prisma/client/runtime/library";
import { applyTransaction, ensureWallet, getSystemWallet } from "../config/sisyacoinHelperFunctions";

// Admin Allocate karta h reward budget from system wallet to mentor/salesman
export async function allocateRewardBudget(req: Request, res: Response) {
    try {
        const { toOwnerType, toOwnerId, amount, reason } = req.body;

        if (!toOwnerType || !toOwnerId || !amount) {
            return res.status(400).json({
                success: false,
                message: "toOwnerType, toOwnerId, and amount are required"
            });
        }

        if (toOwnerType !== "MENTOR" && toOwnerType !== "SALESMAN") {
            return res.status(400).json({
                success: false,
                message: "toOwnerType must be MENTOR or SALESMAN"
            });
        }

        const amountDecimal = new Decimal(amount);
        if (amountDecimal.lte(0)) {
            return res.status(400).json({ success: false, message: "Amount must be positive" });
        }

        const { adminId } = req.body;
        if (!adminId) {
            return res.status(400).json({ success: false, message: "adminId is required in request body" });
        }

        const adminIdNum = typeof adminId === 'number' ? adminId : parseInt(adminId);
        if (isNaN(adminIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid adminId" });
        }

        // Get system wallet
        const systemWallet = await getSystemWallet();

        // Check if system wallet has enough balance - assuming system wallet only have spendable amount 
        if (systemWallet.spendableBalance.lt(amountDecimal)) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance in system wallet"
            });
        }

        // Get or create target wallet
        const targetWallet = await ensureWallet(toOwnerType, parseInt(toOwnerId));

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

        // Update target wallet (increase rewardBudget)
        const targetBalanceBefore = targetWallet.rewardBudget;
        const targetBalanceAfter = targetBalanceBefore.plus(amountDecimal);

        const updatedTargetWallet = await prisma.sisyaWallet.update({
            where: { id: targetWallet.id },
            data: {
                rewardBudget: targetBalanceAfter
            }
        });

        // Create transactions for both wallets
        const systemTransaction = await applyTransaction(
            systemWallet.id,
            "MANUAL_REWARD_BUDGET",
            amountDecimal.negated(),
            "SPENDABLE",
            systemBalanceBefore,
            systemBalanceAfter,
            { reason: reason || "Allocated reward budget", toOwnerType, toOwnerId },
            targetWallet.id,
            undefined,
            "ADMIN",
            adminIdNum
        );

        const targetTransaction = await applyTransaction(
            targetWallet.id,
            "MANUAL_REWARD_BUDGET",
            amountDecimal,
            "REWARD_BUDGET",
            targetBalanceBefore,
            targetBalanceAfter,
            { reason: reason || "Received reward budget allocation", from: "SYSTEM" },
            systemWallet.id,
            undefined,
            "ADMIN",
            adminIdNum
        );

        // Create audit logs
        await Promise.all([
            prisma.sisyaAuditLog.create({
                data: {
                    walletId: systemWallet.id,
                    action: "ALLOCATE_REWARD_BUDGET",
                    actorType: "ADMIN",
                    actorId: adminIdNum,
                    before: systemBalanceBefore,
                    delta: amountDecimal.negated(),
                    after: systemBalanceAfter,
                    note: `Allocated ${amount} to ${toOwnerType} ${toOwnerId}: ${reason || ""}`
                }
            }),
            prisma.sisyaAuditLog.create({
                data: {
                    walletId: targetWallet.id,
                    action: "RECEIVE_REWARD_BUDGET",
                    actorType: "ADMIN",
                    actorId: adminIdNum,
                    before: targetBalanceBefore,
                    delta: amountDecimal,
                    after: targetBalanceAfter,
                    note: `Received reward budget allocation: ${reason || ""}`
                }
            })
        ]);

        return res.json({
            success: true,
            data: {
                systemWallet: updatedSystemWallet,
                targetWallet: updatedTargetWallet,
                transactions: {
                    system: systemTransaction,
                    target: targetTransaction
                }
            }
        });
    } catch (error) {
        console.error("Error allocating reward budget:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Admin Adjust karega (increase ya reduce) reward budget for a user
export async function adjustRewardBudget(req: Request, res: Response) {
    try {
        const { ownerType, ownerId, delta, reason } = req.body;

        if (!ownerType || ownerId === undefined || !delta) {
            return res.status(400).json({
                success: false,
                message: "ownerType, ownerId, and delta are required"
            });
        }

        const validOwnerTypes = ["MENTOR", "SALESMAN"];
        if (!validOwnerTypes.includes(ownerType)) {
            return res.status(400).json({
                success: false,
                message: "ownerType must be MENTOR or SALESMAN"
            });
        }

        const deltaDecimal = new Decimal(delta);
        const { adminId } = req.body;
        if (!adminId) {
            return res.status(400).json({ success: false, message: "adminId is required in request body" });
        }

        const adminIdNum = typeof adminId === 'number' ? adminId : parseInt(adminId);
        if (isNaN(adminIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid adminId" });
        }

        // Get or create wallet
        const wallet = await ensureWallet(ownerType, parseInt(ownerId));

        const balanceBefore = wallet.rewardBudget;
        let balanceAfter: Decimal;

        if (deltaDecimal.lt(0)) {
            // Reducing budget
            if (wallet.rewardBudget.lt(deltaDecimal.abs())) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient reward budget to reduce"
                });
            }
            balanceAfter = balanceBefore.plus(deltaDecimal); // delta is negative, so plus makes it subtract
        } else {
            // Increasing budget
            balanceAfter = balanceBefore.plus(deltaDecimal);
        }

        // Update wallet
        const updatedWallet = await prisma.sisyaWallet.update({
            where: { id: wallet.id },
            data: {
                rewardBudget: balanceAfter
            }
        });

        // Create transaction
        const transaction = await applyTransaction(
            wallet.id,
            "MANUAL_REWARD_BUDGET",
            deltaDecimal,
            "REWARD_BUDGET",
            balanceBefore,
            balanceAfter,
            { reason: reason || "Admin adjustment" },
            undefined,
            undefined,
            "ADMIN",
            typeof adminId === 'number' ? adminId : parseInt(adminId) || undefined
        );

        // Create audit log
        await prisma.sisyaAuditLog.create({
            data: {
                walletId: wallet.id,
                action: "ADJUST_REWARD_BUDGET",
                actorType: "ADMIN",
                actorId: adminIdNum,
                before: balanceBefore,
                delta: deltaDecimal,
                after: balanceAfter,
                note: reason || "Admin adjusted reward budget"
            }
        });

        return res.json({
            success: true,
            data: {
                wallet: updatedWallet,
                transaction
            }
        });
    } catch (error) {
        console.error("Error adjusting reward budget:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Admin: Get reward budget info for a mentor / salesman
export async function getRewardBudget(req: Request, res: Response) {
    try {
        const { ownerType, ownerId } = req.params;

        if (!ownerType || !ownerId) {
            return res.status(400).json({
                success: false,
                message: "ownerType and ownerId are required"
            });
        }

        const wallet = await prisma.sisyaWallet.findUnique({
            where: {
                ownerType_ownerId: {
                    ownerType: ownerType as any,
                    ownerId: parseInt(ownerId)
                }
            }
        });

        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        // Get usage for today and this month
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const [todayUsage, monthUsage] = await Promise.all([
            prisma.sisyaRewardUsage.findUnique({
                where: {
                    walletId_date: {
                        walletId: wallet.id,
                        date: today
                    }
                }
            }),
            prisma.sisyaRewardUsage.findMany({
                where: {
                    walletId: wallet.id,
                    date: { gte: startOfMonth }
                }
            })
        ]);

        const totalMonthUsage = monthUsage.reduce(
            (sum, usage) => sum.plus(usage.amountRewarded),
            new Decimal(0)
        );

        return res.json({
            success: true,
            data: {
                wallet: {
                    id: wallet.id,
                    ownerType: wallet.ownerType,
                    ownerId: wallet.ownerId,
                    rewardBudget: wallet.rewardBudget
                },
                usage: {
                    today: todayUsage?.amountRewarded || new Decimal(0),
                    thisMonth: totalMonthUsage
                }
            }
        });
    } catch (error) {
        console.error("Error getting reward budget:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Admin: Set user - specific reward limit override
export async function setUserRewardLimit(req: Request, res: Response) {
    try {
        const { walletId } = req.params;
        const { dailyLimit, monthlyLimit, isActive } = req.body;

        if (!dailyLimit) {
            return res.status(400).json({ success: false, message: "dailyLimit is required" });
        }

        // Verify wallet exists
        const wallet = await prisma.sisyaWallet.findUnique({
            where: { id: walletId }
        });

        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        const limit = await prisma.sisyaRewardLimitUser.upsert({
            where: { walletId },
            update: {
                dailyLimit: new Decimal(dailyLimit),
                monthlyLimit: monthlyLimit ? new Decimal(monthlyLimit) : null,
                isActive: isActive !== undefined ? isActive : true
            },
            create: {
                walletId,
                dailyLimit: new Decimal(dailyLimit),
                monthlyLimit: monthlyLimit ? new Decimal(monthlyLimit) : null,
                isActive: isActive !== undefined ? isActive : true
            }
        });

        return res.json({ success: true, data: limit });
    } catch (error) {
        console.error("Error setting user reward limit:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Admin: Get user - specific reward limit overrides
export async function getUserRewardLimits(req: Request, res: Response) {
    try {
        const { active } = req.query;

        const where: any = {};
        if (active !== undefined) {
            where.isActive = active === "true";
        }

        const limits = await prisma.sisyaRewardLimitUser.findMany({
            where,
            include: {
                wallet: {
                    select: {
                        ownerType: true,
                        ownerId: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return res.json({ success: true, data: limits });
    } catch (error) {
        console.error("Error getting user reward limits:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

