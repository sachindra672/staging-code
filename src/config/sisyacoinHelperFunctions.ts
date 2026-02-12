import { prisma } from "../misc";
import { Decimal } from "@prisma/client/runtime/library";

const SYSTEM_WALLET_OWNER_ID = 0;

// Get or create System Wallet - altough creation already done by script
export async function getSystemWallet() {
    let systemWallet = await prisma.sisyaWallet.findUnique({
        where: {
            ownerType_ownerId: {
                ownerType: "SYSTEM",
                ownerId: SYSTEM_WALLET_OWNER_ID
            }
        }
    });

    if (!systemWallet) {
        systemWallet = await prisma.sisyaWallet.create({
            data: {
                ownerType: "SYSTEM",
                ownerId: SYSTEM_WALLET_OWNER_ID,
                spendableBalance: 0,
                rewardBudget: 0,
                lockedAmount: 0,
                totalEarned: 0,
                totalSpent: 0
            }
        });
    }

    return systemWallet;
}

// to check if wallet exsist
export async function ensureWallet(ownerType: "ENDUSER" | "MENTOR" | "SALESMAN" | "ADMIN" | "SUBADMIN", ownerId: number) {
    const existing = await prisma.sisyaWallet.findUnique({
        where: {
            ownerType_ownerId: {
                ownerType: ownerType,
                ownerId: ownerId
            }
        }
    });

    if (existing) {
        return existing;
    }

    return await prisma.sisyaWallet.create({
        data: {
            ownerType: ownerType,
            ownerId: ownerId,
            spendableBalance: 0,
            rewardBudget: 0,
            lockedAmount: 0,
            totalEarned: 0,
            totalSpent: 0
        }
    });
}

// create transaction and update wallet balance
export async function applyTransaction(
    walletId: string,
    type: string,
    amount: Decimal,
    balanceType: "SPENDABLE" | "REWARD_BUDGET" | null,
    balanceBefore: Decimal,
    balanceAfter: Decimal,
    metadata?: any,
    counterpartyWalletId?: string,
    reference?: string,
    initiatedByType?: string,
    initiatedById?: number
) {
    return await prisma.sisyaTransaction.create({
        data: {
            walletId,
            type: type as any,
            status: "COMPLETED",
            amount,
            fee: new Decimal(0),
            balanceBefore,
            balanceAfter,
            balanceType: balanceType as any,
            counterpartyWalletId,
            metadata,
            reference,
            initiatedByType: initiatedByType as any,
            initiatedById
        }
    });
}

// Check reward limits and get current usage
export async function checkRewardLimits(
    walletId: string,
    amount: Decimal,
    ownerType: "MENTOR" | "SALESMAN"
): Promise<{ allowed: boolean; reason?: string; dailyLimit: Decimal; monthlyLimit: Decimal | null; todayUsage: Decimal; monthUsage: Decimal }> {
    // Get user-specific limit if exists
    const userLimit = await prisma.sisyaRewardLimitUser.findUnique({
        where: { walletId }
    });

    let dailyLimit: Decimal;
    let monthlyLimit: Decimal | null;

    if (userLimit && userLimit.isActive) {
        dailyLimit = userLimit.dailyLimit;
        monthlyLimit = userLimit.monthlyLimit;
    } else {
        // Get role-based limit
        const roleLimit = await prisma.sisyaRewardLimit.findUnique({
            where: { role: ownerType }
        });

        if (!roleLimit || !roleLimit.isActive) {
            return {
                allowed: false,
                reason: "No reward limit configured for this role",
                dailyLimit: new Decimal(0),
                monthlyLimit: null,
                todayUsage: new Decimal(0),
                monthUsage: new Decimal(0)
            };
        }

        dailyLimit = roleLimit.dailyLimit;
        monthlyLimit = roleLimit.monthlyLimit;
    }

    // Get today's usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayUsage = await prisma.sisyaRewardUsage.findUnique({
        where: {
            walletId_date: {
                walletId,
                date: today
            }
        }
    });

    const todayAmount = todayUsage?.amountRewarded || new Decimal(0);

    // Get this month's usage
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthUsages = await prisma.sisyaRewardUsage.findMany({
        where: {
            walletId,
            date: { gte: startOfMonth }
        }
    });

    const monthAmount = monthUsages.reduce(
        (sum, usage) => sum.plus(usage.amountRewarded),
        new Decimal(0)
    );

    // Check daily limit
    if (todayAmount.plus(amount).gt(dailyLimit)) {
        return {
            allowed: false,
            reason: `Daily limit exceeded. Daily limit: ${dailyLimit}, Today's usage: ${todayAmount}, Requested: ${amount}`,
            dailyLimit,
            monthlyLimit,
            todayUsage: todayAmount,
            monthUsage: monthAmount
        };
    }

    // Check monthly limit if exists
    if (monthlyLimit && monthAmount.plus(amount).gt(monthlyLimit)) {
        return {
            allowed: false,
            reason: `Monthly limit exceeded. Monthly limit: ${monthlyLimit}, This month's usage: ${monthAmount}, Requested: ${amount}`,
            dailyLimit,
            monthlyLimit,
            todayUsage: todayAmount,
            monthUsage: monthAmount
        };
    }

    return {
        allowed: true,
        dailyLimit,
        monthlyLimit,
        todayUsage: todayAmount,
        monthUsage: monthAmount
    };
}

//update reward tracking
export async function updateRewardUsage(walletId: string, amount: Decimal, date: Date) {
    await prisma.sisyaRewardUsage.upsert({
        where: {
            walletId_date: {
                walletId,
                date
            }
        },
        update: {
            amountRewarded: { increment: amount }
        },
        create: {
            walletId,
            date,
            amountRewarded: amount
        }
    });
}

// pahle expiry wala coin use karna h
export async function spendWithExpiryFirst(walletId: string, amount: Decimal): Promise<{
    success: boolean;
    expiryUsed: Decimal;
    normalUsed: Decimal;
    transactions: any[];
}> {
    const wallet = await prisma.sisyaWallet.findUnique({
        where: { id: walletId }
    });

    if (!wallet) {
        throw new Error("Wallet not found");
    }

    let remaining = amount;
    const transactions: any[] = [];
    let expiryUsed = new Decimal(0);
    let normalUsed = new Decimal(0);

    // Get expiring balances ordered by expiry date (nearest first)
    const expiringBalances = await prisma.sisyaExpiryBalance.findMany({
        where: {
            walletId,
            isExpired: false,
            expiresAt: { gt: new Date() }
        },
        orderBy: { expiresAt: "asc" }
    });

    // Use expiring balances first
    for (const expBal of expiringBalances) {
        if (remaining.lte(0)) break;

        const available = expBal.amountTotal.minus(expBal.amountUsed).minus(expBal.amountExpired);
        if (available.lte(0)) continue;

        const toUse = Decimal.min(remaining, available);
        const newAmountUsed = expBal.amountUsed.plus(toUse);

        await prisma.sisyaExpiryBalance.update({
            where: { id: expBal.id },
            data: { amountUsed: newAmountUsed }
        });

        expiryUsed = expiryUsed.plus(toUse);
        remaining = remaining.minus(toUse);
    }

    // Use normal spendable balance for remainder
    if (remaining.gt(0)) {
        if (wallet.spendableBalance.lt(remaining)) {
            // Rollback expiry usage? For now, just return error
            return {
                success: false,
                expiryUsed,
                normalUsed: new Decimal(0),
                transactions: []
            };
        }

        normalUsed = remaining;
    }

    // Update wallet
    const balanceBefore = wallet.spendableBalance;
    const balanceAfter = balanceBefore.minus(normalUsed);

    await prisma.sisyaWallet.update({
        where: { id: walletId },
        data: {
            spendableBalance: balanceAfter,
            totalSpent: wallet.totalSpent.plus(amount)
        }
    });

    // Create transaction
    const transaction = await prisma.sisyaTransaction.create({
        data: {
            walletId,
            type: "PURCHASE",
            status: "COMPLETED",
            amount: amount.negated(),
            fee: new Decimal(0),
            balanceBefore,
            balanceAfter,
            balanceType: "SPENDABLE",
            metadata: {
                expiryUsed: expiryUsed.toString(),
                normalUsed: normalUsed.toString()
            }
        }
    });

    transactions.push(transaction);

    return {
        success: true,
        expiryUsed,
        normalUsed,
        transactions
    };
}