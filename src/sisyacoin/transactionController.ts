import { Request, Response } from "express";
import { prisma } from "../misc";

// current user's transaction history
export async function getMyTransactions(req: Request, res: Response) {
    try {
        const { page = 1, limit = 50, type, from, to, id } = req.query;
        const role = req.role;

        if (!role) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!id) {
            return res.status(400).json({ success: false, message: "id is required in query params" });
        }

        let ownerType: "ENDUSER" | "MENTOR" | "SALESMAN" | "ADMIN" | "SUBADMIN";
        let ownerId: number;

        // Map role to OwnerType and get ownerId from query
        if (role === "user") {
            ownerType = "ENDUSER";
            const endUser = await prisma.endUsers.findFirst({
                where: {
                    OR: [
                        { id: typeof id === 'number' ? id : parseInt(id as string) || 0 },
                        { phone: typeof id === 'string' ? id : String(id) }
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
            ownerId = typeof id === 'number' ? id : parseInt(id as string);
            if (isNaN(ownerId)) {
                return res.status(400).json({ success: false, message: "Invalid id" });
            }
        } else if (role === "admin" || role === "subadmin") {
            ownerType = role === "admin" ? "ADMIN" : "SUBADMIN";
            ownerId = typeof id === 'number' ? id : parseInt(id as string);
            if (isNaN(ownerId)) {
                return res.status(400).json({ success: false, message: "Invalid id" });
            }
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

// Get this week's transactions (Monday to Sunday)
export async function getThisWeekTransactions(req: Request, res: Response) {
    try {
        const { page = 1, limit = 50, type, id } = req.query;
        const role = req.role;

        if (!role) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!id) {
            return res.status(400).json({ success: false, message: "id is required in query params" });
        }

        let ownerType: "ENDUSER" | "MENTOR" | "SALESMAN" | "ADMIN" | "SUBADMIN";
        let ownerId: number;

        // Map role to OwnerType and get ownerId from query
        if (role === "user") {
            ownerType = "ENDUSER";
            const endUser = await prisma.endUsers.findFirst({
                where: {
                    OR: [
                        { id: typeof id === 'number' ? id : parseInt(id as string) || 0 },
                        { phone: typeof id === 'string' ? id : String(id) }
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
            ownerId = typeof id === 'number' ? id : parseInt(id as string);
            if (isNaN(ownerId)) {
                return res.status(400).json({ success: false, message: "Invalid id" });
            }
        } else if (role === "admin" || role === "subadmin") {
            ownerType = role === "admin" ? "ADMIN" : "SUBADMIN";
            ownerId = typeof id === 'number' ? id : parseInt(id as string);
            if (isNaN(ownerId)) {
                return res.status(400).json({ success: false, message: "Invalid id" });
            }
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

        // Calculate start of week (Monday) and end of week (Sunday)
        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const daysToMonday = currentDay === 0 ? 6 : currentDay - 1; // Days to subtract to get Monday

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - daysToMonday);
        startOfWeek.setHours(0, 0, 0, 0); // Start of Monday (00:00:00)

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
        endOfWeek.setHours(23, 59, 59, 999); // End of Sunday (23:59:59)

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const skip = (pageNumber - 1) * pageSize;

        const where: any = {
            walletId: wallet.id,
            createdAt: {
                gte: startOfWeek,
                lte: endOfWeek
            }
        };

        if (type) {
            where.type = type;
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
            weekRange: {
                start: startOfWeek.toISOString(),
                end: endOfWeek.toISOString()
            },
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error("Error getting this week's transactions:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Get today's transactions
export async function getTodayTransactions(req: Request, res: Response) {
    try {
        const { page = 1, limit = 50, type, id } = req.query;
        const role = req.role;

        if (!role) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!id) {
            return res.status(400).json({ success: false, message: "id is required in query params" });
        }

        let ownerType: "ENDUSER" | "MENTOR" | "SALESMAN" | "ADMIN" | "SUBADMIN";
        let ownerId: number;

        // Map role to OwnerType and get ownerId from query
        if (role === "user") {
            ownerType = "ENDUSER";
            const endUser = await prisma.endUsers.findFirst({
                where: {
                    OR: [
                        { id: typeof id === 'number' ? id : parseInt(id as string) || 0 },
                        { phone: typeof id === 'string' ? id : String(id) }
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
            ownerId = typeof id === 'number' ? id : parseInt(id as string);
            if (isNaN(ownerId)) {
                return res.status(400).json({ success: false, message: "Invalid id" });
            }
        } else if (role === "admin" || role === "subadmin") {
            ownerType = role === "admin" ? "ADMIN" : "SUBADMIN";
            ownerId = typeof id === 'number' ? id : parseInt(id as string);
            if (isNaN(ownerId)) {
                return res.status(400).json({ success: false, message: "Invalid id" });
            }
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

        // Calculate start of today (00:00:00) and end of today (23:59:59)
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0); // Start of today (00:00:00)

        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999); // End of today (23:59:59)

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const skip = (pageNumber - 1) * pageSize;

        const where: any = {
            walletId: wallet.id,
            createdAt: {
                gte: startOfToday,
                lte: endOfToday
            }
        };

        if (type) {
            where.type = type;
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
            dateRange: {
                start: startOfToday.toISOString(),
                end: endOfToday.toISOString()
            },
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error("Error getting today's transactions:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

