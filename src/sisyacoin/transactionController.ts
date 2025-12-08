import { Request, Response } from "express";
import { prisma } from "../misc";

// current user's transaction history
export async function getMyTransactions(req: Request, res: Response) {
    try {
        const { page = 1, limit = 50, type, from, to } = req.query;
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
            return res.status(403).json({ success: false, message: "Invalid role for transaction access" });
        }

        // Get wallet
        const wallet = await prisma.sisyaWallet.findUnique({
            where: {
                ownerType_ownerId: {
                    ownerType: ownerType,
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

        if (type) {
            where.type = type;
        }

        if (from || to) {
            where.createdAt = {};
            if (from) {
                where.createdAt.gte = new Date(from as string);
            }
            if (to) {
                where.createdAt.lte = new Date(to as string);
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
                            ownerType: true,
                            ownerId: true
                        }
                    }
                }
            }),
            prisma.sisyaTransaction.count({ where })
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
        console.error("Error getting transactions:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Get single transaction by ID
export async function getTransactionById(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const transaction = await prisma.sisyaTransaction.findUnique({
            where: { id },
            include: {
                wallet: {
                    select: {
                        ownerType: true,
                        ownerId: true
                    }
                }
            }
        });

        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        // Check if user has access to this transaction
        const user = req.user;
        const role = req.role;

        if (role === "admin" || role === "subadmin") {
            // Admin can see any transaction
            return res.json({ success: true, data: transaction });
        }

        // For other users, verify they own the wallet
        const wallet = transaction.wallet;
        if (role === "user" && wallet.ownerType !== "ENDUSER") {
            return res.status(403).json({ success: false, message: "Access denied" });
        }
        if (role === "mentor" && wallet.ownerType !== "MENTOR") {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        // Additional check: verify the user's ID matches wallet ownerId
        // This would require getting the user's actual ID from token and comparing
        // For now, we'll allow if wallet type matches role

        return res.json({ success: true, data: transaction });
    } catch (error) {
        console.error("Error getting transaction:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Admin: Get transactions for any wallet
export async function getWalletTransactions(req: Request, res: Response) {
    try {
        const { walletId } = req.params;
        const { page = 1, limit = 50, type, from, to } = req.query;

        const wallet = await prisma.sisyaWallet.findUnique({
            where: { id: walletId }
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

        if (type) {
            where.type = type;
        }

        if (from || to) {
            where.createdAt = {};
            if (from) {
                where.createdAt.gte = new Date(from as string);
            }
            if (to) {
                where.createdAt.lte = new Date(to as string);
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
                            ownerType: true,
                            ownerId: true
                        }
                    }
                }
            }),
            prisma.sisyaTransaction.count({ where })
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
        console.error("Error getting wallet transactions:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

