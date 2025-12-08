import { Request, Response } from "express";
import { prisma } from "../misc";
import { ensureWallet } from "../config/sisyacoinHelperFunctions";

// Get current user's wallet
export async function getMyWallet(req: Request, res: Response) {
    try {
        const user = req.user;
        const role = req.role;

        if (!user || !role) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        let ownerType: "ENDUSER" | "MENTOR" | "SALESMAN" | "ADMIN" | "SUBADMIN";
        let ownerId: number;

        // Map role to OwnerType and get ownerId
        if (role === "user") {
            ownerType = "ENDUSER";
            const userId = user.user || user.id || user.selfId;
            if (!userId) {
                return res.status(400).json({ success: false, message: "User ID not found in token" });
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
            ownerId = endUser.id;
        } else if (role === "mentor") {
            ownerType = "MENTOR";
            const mentorId = user.user || user.id || user.selfId;
            if (!mentorId) {
                return res.status(400).json({ success: false, message: "Mentor ID not found in token" });
            }
            ownerId = typeof mentorId === 'number' ? mentorId : parseInt(mentorId) || 0;
        } else if (role === "admin" || role === "subadmin") {
            ownerType = role === "admin" ? "ADMIN" : "SUBADMIN";
            const adminId = user.user || user.id || user.selfId;
            if (!adminId) {
                return res.status(400).json({ success: false, message: "Admin ID not found in token" });
            }
            ownerId = typeof adminId === 'number' ? adminId : parseInt(adminId) || 0;
        } else {
            return res.status(403).json({ success: false, message: "Invalid role for wallet access" });
        }

        // Ensure wallet exists
        const wallet = await ensureWallet(ownerType, ownerId);

        // Get additional info: expiring balances, locks
        const [expiringBalances, locks] = await Promise.all([
            prisma.sisyaExpiryBalance.findMany({
                where: {
                    walletId: wallet.id,
                    isExpired: false,
                    expiresAt: { gt: new Date() }
                },
                orderBy: { expiresAt: "asc" },
                take: 5
            }),
            prisma.sisyaLock.findMany({
                where: {
                    walletId: wallet.id,
                    isReleased: false,
                    unlocksAt: { gt: new Date() }
                },
                orderBy: { unlocksAt: "asc" },
                take: 5
            })
        ]);

        return res.json({
            success: true,
            data: {
                ...wallet,
                expiringBalances: expiringBalances.map(eb => ({
                    amountTotal: eb.amountTotal,
                    amountUsed: eb.amountUsed,
                    amountRemaining: eb.amountTotal.minus(eb.amountUsed).minus(eb.amountExpired),
                    expiresAt: eb.expiresAt
                })),
                activeLocks: locks.map(lock => ({
                    amount: lock.amount,
                    remaining: lock.remaining,
                    unlocksAt: lock.unlocksAt,
                    lockType: lock.lockType
                }))
            }
        });
    } catch (error) {
        console.error("Error getting wallet:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Get wallet by owner type and ID
export async function getWalletByOwner(req: Request, res: Response) {
    try {
        const { ownerType, ownerId } = req.params;

        if (!ownerType || !ownerId) {
            return res.status(400).json({ success: false, message: "ownerType and ownerId are required" });
        }

        const validOwnerTypes = ["ENDUSER", "MENTOR", "SALESMAN", "ADMIN", "SUBADMIN", "SYSTEM"];
        if (!validOwnerTypes.includes(ownerType)) {
            return res.status(400).json({ success: false, message: "Invalid ownerType" });
        }

        const ownerIdNum = parseInt(ownerId);
        if (isNaN(ownerIdNum)) {
            return res.status(400).json({ success: false, message: "Invalid ownerId" });
        }

        const wallet = await prisma.sisyaWallet.findUnique({
            where: {
                ownerType_ownerId: {
                    ownerType: ownerType as any,
                    ownerId: ownerIdNum
                }
            },
            include: {
                rewardLimitUser: true,
                _count: {
                    select: {
                        transactions: true,
                        locks: true,
                        expiryBalances: true
                    }
                }
            }
        });

        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        return res.json({ success: true, data: wallet });
    } catch (error) {
        console.error("Error getting wallet by owner:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Admin: List all wallets with pagination
export async function getAllWallets(req: Request, res: Response) {
    try {
        const { page = 1, limit = 50, ownerType, search } = req.query;

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
        if (ownerType) {
            where.ownerType = ownerType;
        }

        const [wallets, total] = await Promise.all([
            prisma.sisyaWallet.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    ownerType: true,
                    ownerId: true,
                    spendableBalance: true,
                    rewardBudget: true,
                    lockedAmount: true,
                    totalEarned: true,
                    totalSpent: true,
                    createdAt: true,
                    updatedAt: true
                }
            }),
            prisma.sisyaWallet.count({ where })
        ]);

        return res.json({
            success: true,
            data: wallets,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (error) {
        console.error("Error getting all wallets:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

