import { Request, Response } from "express";
import { prisma } from "../misc";
import { Decimal } from "@prisma/client/runtime/library";
import { applyTransaction, getSystemWallet, ensureWallet } from "../config/sisyacoinHelperFunctions";

// mint the coin into the system wallet 
export async function mintCoins(req: Request, res: Response) {
    try {
        const { amount, reason } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Valid amount is required" });
        }

        const { adminId } = req.body;
        if (!adminId) {
            return res.status(400).json({ success: false, message: "adminId is required in request body" });
        }

        const adminIdNum = typeof adminId === 'number' ? adminId : parseInt(adminId);
        if (isNaN(adminIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid adminId" });
        }

        const systemWallet = await getSystemWallet();
        const amountDecimal = new Decimal(amount);
        const balanceBefore = systemWallet.spendableBalance;
        const balanceAfter = balanceBefore.plus(amountDecimal);

        // wallet update
        const updatedWallet = await prisma.sisyaWallet.update({
            where: { id: systemWallet.id },
            data: {
                spendableBalance: balanceAfter,
                totalEarned: systemWallet.totalEarned.plus(amountDecimal)
            }
        });

        const transaction = await applyTransaction(
            systemWallet.id,
            "MINT",
            amountDecimal,
            "SPENDABLE",
            balanceBefore,
            balanceAfter,
            { reason: reason || "Admin mint" },
            undefined,
            undefined,
            "ADMIN",
            adminIdNum
        );

        // add in audit log
        await prisma.sisyaAuditLog.create({
            data: {
                walletId: systemWallet.id,
                action: "MINT_COINS",
                actorType: "ADMIN",
                actorId: adminIdNum,
                before: balanceBefore,
                delta: amountDecimal,
                after: balanceAfter,
                note: reason || "Admin minted coins"
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
        console.error("Error minting coins:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Admin: directly assign coins from System wallet to an End User wallet
// Body: { adminId, toUserId, amount, reason? }
export async function adminAssignCoinsToUser(req: Request, res: Response) {
    try {
        const { adminId, toUserId, amount, reason } = req.body;

        if (!adminId) {
            return res.status(400).json({ success: false, message: "adminId is required in request body" });
        }
        if (!toUserId) {
            return res.status(400).json({ success: false, message: "toUserId is required in request body" });
        }
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Valid amount is required" });
        }

        const adminIdNum = typeof adminId === "number" ? adminId : parseInt(adminId);
        const toUserIdNum = typeof toUserId === "number" ? toUserId : parseInt(toUserId);

        if (isNaN(adminIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid adminId" });
        }
        if (isNaN(toUserIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid toUserId" });
        }

        const amountDecimal = new Decimal(amount);
        if (amountDecimal.lte(0)) {
            return res.status(400).json({ success: false, message: "Amount must be positive" });
        }

        // Get system wallet and ensure user wallet exists
        const systemWallet = await getSystemWallet();
        const userWallet = await ensureWallet("ENDUSER", toUserIdNum);

        // Check system wallet balance
        if (systemWallet.spendableBalance.lt(amountDecimal)) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance in system wallet",
            });
        }

        // Update system wallet (debit)
        const sysBalanceBefore = systemWallet.spendableBalance;
        const sysBalanceAfter = sysBalanceBefore.minus(amountDecimal);

        const updatedSystemWallet = await prisma.sisyaWallet.update({
            where: { id: systemWallet.id },
            data: {
                spendableBalance: sysBalanceAfter,
                totalSpent: systemWallet.totalSpent.plus(amountDecimal),
            },
        });

        // Update user wallet (credit)
        const userBalanceBefore = userWallet.spendableBalance;
        const userBalanceAfter = userBalanceBefore.plus(amountDecimal);

        const updatedUserWallet = await prisma.sisyaWallet.update({
            where: { id: userWallet.id },
            data: {
                spendableBalance: userBalanceAfter,
                totalEarned: userWallet.totalEarned.plus(amountDecimal),
            },
        });

        // Transactions (reuse MANUAL_REWARD type to match existing enum)
        const sysTxn = await applyTransaction(
            systemWallet.id,
            "MANUAL_REWARD",
            amountDecimal.negated(),
            "SPENDABLE",
            sysBalanceBefore,
            sysBalanceAfter,
            {
                reason: reason || "Admin direct assign to user",
                toUserId: toUserIdNum,
                source: "SYSTEM_WALLET",
            },
            userWallet.id,
            undefined,
            "ADMIN",
            adminIdNum
        );

        const userTxn = await applyTransaction(
            userWallet.id,
            "MANUAL_REWARD",
            amountDecimal,
            "SPENDABLE",
            userBalanceBefore,
            userBalanceAfter,
            {
                reason: reason || "Admin direct assign from system wallet",
                fromOwnerType: "SYSTEM",
                fromOwnerId: 0,
                adminId: adminIdNum,
            },
            systemWallet.id,
            undefined,
            "ADMIN",
            adminIdNum
        );

        // Audit logs for both wallets
        await Promise.all([
            prisma.sisyaAuditLog.create({
                data: {
                    walletId: systemWallet.id,
                    action: "ADMIN_ASSIGN_SYSTEM_DEBIT",
                    actorType: "ADMIN",
                    actorId: adminIdNum,
                    before: sysBalanceBefore,
                    delta: amountDecimal.negated(),
                    after: sysBalanceAfter,
                    note: `Assigned ${amount} coins to endUser ${toUserIdNum}: ${reason || ""}`,
                },
            }),
            prisma.sisyaAuditLog.create({
                data: {
                    walletId: userWallet.id,
                    action: "ADMIN_ASSIGN_USER_CREDIT",
                    actorType: "ADMIN",
                    actorId: adminIdNum,
                    before: userBalanceBefore,
                    delta: amountDecimal,
                    after: userBalanceAfter,
                    note: `Received ${amount} coins from system wallet by admin ${adminIdNum}: ${reason || ""}`,
                },
            }),
        ]);

        return res.json({
            success: true,
            data: {
                systemWallet: updatedSystemWallet,
                userWallet: updatedUserWallet,
                transactions: {
                    system: sysTxn,
                    user: userTxn,
                },
            },
        });
    } catch (error) {
        console.error("Error assigning coins from system to user:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// burn the coin into system wallet 
// amount, reason(optional)- take from body
// admin details from the middleware
export async function burnCoins(req: Request, res: Response) {
    try {
        const { amount, reason } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Valid amount is required" });
        }

        const { adminId } = req.body;
        if (!adminId) {
            return res.status(400).json({ success: false, message: "adminId is required in request body" });
        }

        const adminIdNum = typeof adminId === 'number' ? adminId : parseInt(adminId);
        if (isNaN(adminIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid adminId" });
        }

        const systemWallet = await getSystemWallet();
        const amountDecimal = new Decimal(amount);

        if (systemWallet.spendableBalance.lt(amountDecimal)) {
            return res.status(400).json({ success: false, message: "Insufficient balance in system wallet" });
        }

        const balanceBefore = systemWallet.spendableBalance;
        const balanceAfter = balanceBefore.minus(amountDecimal);

        // wallet update
        const updatedWallet = await prisma.sisyaWallet.update({
            where: { id: systemWallet.id },
            data: {
                spendableBalance: balanceAfter,
                totalSpent: systemWallet.totalSpent.plus(amountDecimal)
            }
        });

        // Create transaction
        const transaction = await applyTransaction(
            systemWallet.id,
            "BURN",
            amountDecimal.negated(),
            "SPENDABLE",
            balanceBefore,
            balanceAfter,
            { reason: reason || "Admin burn" },
            undefined,
            undefined,
            "ADMIN",
            adminIdNum
        );

        // add in audit log
        await prisma.sisyaAuditLog.create({
            data: {
                walletId: systemWallet.id,
                action: "BURN_COINS",
                actorType: "ADMIN",
                actorId: adminIdNum,
                before: balanceBefore,
                delta: amountDecimal.negated(),
                after: balanceAfter,
                note: reason || "Admin burned coins"
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
        console.error("Error burning coins:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// create the conversion rate
export async function createRate(req: Request, res: Response) {
    try {
        const { baseCurrency, coinsPerUnit, offerPercent, effectiveFrom, effectiveTo } = req.body;

        if (!baseCurrency || !coinsPerUnit || !effectiveFrom) {
            return res.status(400).json({
                success: false,
                message: "baseCurrency, coinsPerUnit, and effectiveFrom are required"
            });
        }

        const rate = await prisma.sisyaRate.create({
            data: {
                baseCurrency,
                coinsPerUnit: new Decimal(coinsPerUnit),
                offerPercent: offerPercent ? parseInt(offerPercent) : null,
                effectiveFrom: new Date(effectiveFrom),
                effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
                isActive: true
            }
        });

        return res.json({ success: true, data: rate });
    } catch (error) {
        console.error("Error creating rate:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// to know active rate or all rate for particular currency
export async function getRates(req: Request, res: Response) {
    try {
        const { currency, active } = req.body;

        const where: any = {};
        if (currency) {
            where.baseCurrency = currency;
        }
        if (active !== undefined) {
            where.isActive = active === "true";
        }

        const rates = await prisma.sisyaRate.findMany({
            where,
            orderBy: { effectiveFrom: "desc" }
        });

        return res.json({ success: true, data: rates });
    } catch (error) {
        console.error("Error getting rates:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// update rate (deactivate ya fir modify)
export async function updateRate(req: Request, res: Response) {
    try {
        const { id, coinsPerUnit, offerPercent, effectiveTo, isActive } = req.body;

        const updateData: any = {};
        if (coinsPerUnit !== undefined) updateData.coinsPerUnit = new Decimal(coinsPerUnit);
        if (offerPercent !== undefined) updateData.offerPercent = offerPercent ? parseInt(offerPercent) : null;
        if (effectiveTo !== undefined) updateData.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
        if (isActive !== undefined) updateData.isActive = isActive;

        const rate = await prisma.sisyaRate.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        return res.json({ success: true, data: rate });
    } catch (error) {
        console.error("Error updating rate:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// particular role ke liye reward limit
export async function setRoleRewardLimit(req: Request, res: Response) {
    try {
        const { ownerType, dailyLimit, monthlyLimit, isActive } = req.body;

        if (!dailyLimit) {
            return res.status(400).json({ success: false, message: "dailyLimit is required" });
        }

        const validOwnerTypes = ["ENDUSER", "MENTOR", "SALESMAN", "ADMIN", "SUBADMIN"];
        if (!validOwnerTypes.includes(ownerType)) {
            return res.status(400).json({ success: false, message: "Invalid ownerType" });
        }

        const limit = await prisma.sisyaRewardLimit.upsert({
            where: { role: ownerType as any },
            update: {
                dailyLimit: new Decimal(dailyLimit),
                monthlyLimit: monthlyLimit ? new Decimal(monthlyLimit) : null,
                isActive: isActive !== undefined ? isActive : true
            },
            create: {
                role: ownerType as any,
                dailyLimit: new Decimal(dailyLimit),
                monthlyLimit: monthlyLimit ? new Decimal(monthlyLimit) : null,
                isActive: isActive !== undefined ? isActive : true
            }
        });

        return res.json({ success: true, data: limit });
    } catch (error) {
        console.error("Error setting role reward limit:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// get role reward limit
export async function getRoleRewardLimits(_req: Request, res: Response) {
    try {
        const limits = await prisma.sisyaRewardLimit.findMany({
            where: { isActive: true },
            orderBy: { role: "asc" }
        });

        return res.json({ success: true, data: limits });
    } catch (error) {
        console.error("Error getting role reward limits:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

