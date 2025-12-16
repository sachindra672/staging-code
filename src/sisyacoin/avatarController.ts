import { Request, Response } from "express";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../misc";
import { ensureWallet } from "../config/sisyacoinHelperFunctions";

function parseBooleanFlag(value: any, defaultValue: boolean) {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes"].includes(normalized)) return true;
        if (["false", "0", "no"].includes(normalized)) return false;
    }
    return defaultValue;
}

function parseNullableInt(value: any) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const parsed = typeof value === "string" ? parseInt(value, 10) : value;

    if (Number.isNaN(parsed)) {
        return NaN;
    }

    return parsed;
}

export async function getAvatars(req: Request, res: Response) {
    try {
        const { page = 1, limit = 50, includeInactive, search, isLimited } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const skip = (pageNumber - 1) * pageSize;

        const where: any = {};

        if (includeInactive !== "true") {
            where.isActive = true;
        }

        if (typeof search === "string" && search.trim()) {
            where.name = { contains: search.trim(), mode: "insensitive" };
        }

        if (isLimited !== undefined) {
            const normalizedIsLimited = Array.isArray(isLimited) ? isLimited[0] : isLimited;
            where.isLimited = parseBooleanFlag(normalizedIsLimited, true);
        }

        const [avatars, total] = await Promise.all([
            prisma.sisyaAvatar.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" }
            }),
            prisma.sisyaAvatar.count({ where })
        ]);

        return res.json({
            success: true,
            data: avatars,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error("Error getting avatars:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function createAvatar(req: Request, res: Response) {
    try {
        const { name, description, imageUrl, priceCoins, originalCoins, isActive, isLimited, totalSupply, metadata } = req.body;

        if (!name || priceCoins === undefined) {
            return res.status(400).json({ success: false, message: "name and priceCoins are required" });
        }

        const price = new Decimal(priceCoins);
        if (price.lte(0)) {
            return res.status(400).json({ success: false, message: "priceCoins must be greater than zero" });
        }

        const priceOriginal = originalCoins !== undefined && originalCoins !== null && originalCoins !== ""
            ? new Decimal(originalCoins)
            : null;

        const limited = parseBooleanFlag(isLimited, false);
        const active = parseBooleanFlag(isActive, true);

        const supply = parseNullableInt(totalSupply);
        if (Number.isNaN(supply as number)) {
            return res.status(400).json({ success: false, message: "Invalid totalSupply" });
        }

        if (limited && (supply === null || (supply as number) <= 0)) {
            return res.status(400).json({ success: false, message: "Limited avatars require a positive totalSupply" });
        }

        const avatar = await prisma.sisyaAvatar.create({
            data: {
                name,
                description,
                imageUrl,
                priceCoins: price,
                originalCoins: priceOriginal,
                isActive: active,
                isLimited: limited,
                totalSupply: supply,
                metadata
            }
        });

        return res.json({ success: true, data: avatar });
    } catch (error) {
        console.error("Error creating avatar:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function updateAvatar(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { name, description, imageUrl, priceCoins, originalCoins, isActive, isLimited, totalSupply, metadata } = req.body;

        const existing = await prisma.sisyaAvatar.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Avatar not found" });
        }

        const updateData: any = {};

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (priceCoins !== undefined) {
            const price = new Decimal(priceCoins);
            if (price.lte(0)) {
                return res.status(400).json({ success: false, message: "priceCoins must be greater than zero" });
            }
            updateData.priceCoins = price;
        }
        if (originalCoins !== undefined) {
            updateData.originalCoins = originalCoins === null || originalCoins === "" ? null : new Decimal(originalCoins);
        }
        if (isActive !== undefined) {
            updateData.isActive = parseBooleanFlag(isActive, existing.isActive);
        }
        if (isLimited !== undefined) {
            updateData.isLimited = parseBooleanFlag(isLimited, existing.isLimited);
        }
        if (metadata !== undefined) {
            updateData.metadata = metadata;
        }

        if (totalSupply !== undefined) {
            const supply = parseNullableInt(totalSupply);
            if (Number.isNaN(supply as number)) {
                return res.status(400).json({ success: false, message: "Invalid totalSupply" });
            }

            if (supply !== null) {
                const soldCount = await prisma.sisyaAvatarPurchase.count({ where: { avatarId: id } });
                if (supply < soldCount) {
                    return res.status(400).json({ success: false, message: "totalSupply cannot be less than already sold units" });
                }
            }

            updateData.totalSupply = supply;
        }

        const avatar = await prisma.sisyaAvatar.update({
            where: { id },
            data: updateData
        });

        return res.json({ success: true, data: avatar });
    } catch (error) {
        console.error("Error updating avatar:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function purchaseAvatar(req: Request, res: Response) {
    try {
        const { avatarId, userId } = req.body;
        const role = req.role;

        if (role !== "user") {
            return res.status(403).json({ success: false, message: "Only end users can purchase avatars" });
        }

        if (!avatarId) {
            return res.status(400).json({ success: false, message: "avatarId is required" });
        }

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required in request body" });
        }

        const endUser = await prisma.endUsers.findFirst({
            where: {
                OR: [
                    { id: typeof userId === "number" ? userId : parseInt(userId) || 0 },
                    { phone: typeof userId === "string" ? userId : String(userId) }
                ]
            },
            select: { id: true }
        });

        if (!endUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const wallet = await ensureWallet("ENDUSER", endUser.id);

        const result = await prisma.$transaction(async (tx) => {
            const avatar = await tx.sisyaAvatar.findUnique({
                where: { id: avatarId },
                select: {
                    id: true,
                    name: true,
                    priceCoins: true,
                    isActive: true,
                    isLimited: true,
                    totalSupply: true,
                    _count: { select: { purchases: true } }
                }
            });

            if (!avatar || !avatar.isActive) {
                throw new Error("AVATAR_NOT_AVAILABLE");
            }

            if (avatar.isLimited && avatar.totalSupply !== null && avatar._count.purchases >= avatar.totalSupply) {
                throw new Error("AVATAR_SOLD_OUT");
            }

            const existingPurchase = await tx.sisyaAvatarPurchase.findUnique({
                where: {
                    walletId_avatarId: {
                        walletId: wallet.id,
                        avatarId: avatar.id
                    }
                }
            });

            if (existingPurchase) {
                throw new Error("AVATAR_ALREADY_OWNED");
            }

            const walletInTx = await tx.sisyaWallet.findUnique({ where: { id: wallet.id } });
            if (!walletInTx) {
                throw new Error("WALLET_NOT_FOUND");
            }

            const expiringBalances = await tx.sisyaExpiryBalance.findMany({
                where: {
                    walletId: wallet.id,
                    isExpired: false,
                    expiresAt: { gt: new Date() }
                },
                orderBy: { expiresAt: "asc" }
            });

            const totalExpiringAvailable = expiringBalances.reduce(
                (sum, eb) => sum.plus(eb.amountTotal.minus(eb.amountUsed).minus(eb.amountExpired)),
                new Decimal(0)
            );

            const totalAvailable = walletInTx.spendableBalance.plus(totalExpiringAvailable);

            if (totalAvailable.lt(avatar.priceCoins)) {
                throw new Error("INSUFFICIENT_BALANCE");
            }

            let remaining = avatar.priceCoins;
            let expiryUsed = new Decimal(0);
            let normalUsed = new Decimal(0);

            for (const expBal of expiringBalances) {
                if (remaining.lte(0)) break;

                const available = expBal.amountTotal.minus(expBal.amountUsed).minus(expBal.amountExpired);
                if (available.lte(0)) continue;

                const toUse = Decimal.min(remaining, available);
                await tx.sisyaExpiryBalance.update({
                    where: { id: expBal.id },
                    data: { amountUsed: expBal.amountUsed.plus(toUse) }
                });

                expiryUsed = expiryUsed.plus(toUse);
                remaining = remaining.minus(toUse);
            }

            if (remaining.gt(0)) {
                if (walletInTx.spendableBalance.lt(remaining)) {
                    throw new Error("INSUFFICIENT_BALANCE");
                }
                normalUsed = remaining;
            }

            const balanceBefore = walletInTx.spendableBalance;
            const balanceAfter = balanceBefore.minus(normalUsed);

            await tx.sisyaWallet.update({
                where: { id: wallet.id },
                data: {
                    spendableBalance: balanceAfter,
                    totalSpent: walletInTx.totalSpent.plus(avatar.priceCoins)
                }
            });

            const purchase = await tx.sisyaAvatarPurchase.create({
                data: {
                    walletId: wallet.id,
                    avatarId: avatar.id,
                    pricePaid: avatar.priceCoins
                },
                include: {
                    avatar: true
                }
            });

            await tx.sisyaTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: "PURCHASE_ITEM",
                    status: "COMPLETED",
                    amount: avatar.priceCoins.negated(),
                    fee: new Decimal(0),
                    balanceBefore,
                    balanceAfter,
                    balanceType: "SPENDABLE",
                    metadata: {
                        reason: `Avatar purchase: ${avatar.name}`,
                        avatarId: avatar.id,
                        avatarName: avatar.name,
                        expiryUsed: expiryUsed.toString(),
                        normalUsed: normalUsed.toString()
                    }
                }
            });

            return purchase;
        });

        return res.json({ success: true, data: result });
    } catch (error: any) {
        console.error("Error purchasing avatar:", error);

        const message = typeof error?.message === "string" ? error.message : "";

        if (message === "AVATAR_NOT_AVAILABLE") {
            return res.status(404).json({ success: false, message: "Avatar not found or inactive" });
        }
        if (message === "AVATAR_SOLD_OUT") {
            return res.status(400).json({ success: false, message: "Avatar is sold out" });
        }
        if (message === "AVATAR_ALREADY_OWNED") {
            return res.status(400).json({ success: false, message: "Avatar already owned" });
        }
        if (message === "INSUFFICIENT_BALANCE") {
            return res.status(400).json({ success: false, message: "Insufficient balance" });
        }
        if (message === "WALLET_NOT_FOUND") {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }

        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getMyAvatars(req: Request, res: Response) {
    try {
        const { userId, page = 1, limit = 50 } = req.query;
        const role = req.role;

        if (role !== "user") {
            return res.status(403).json({ success: false, message: "Only end users can access this" });
        }

        if (!userId) {
            return res.status(400).json({ success: false, message: "userId is required in query params" });
        }

        const endUser = await prisma.endUsers.findFirst({
            where: {
                OR: [
                    { id: typeof userId === "number" ? userId : parseInt(userId as string) || 0 },
                    { phone: typeof userId === "string" ? userId : String(userId) }
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

        const [purchases, total] = await Promise.all([
            prisma.sisyaAvatarPurchase.findMany({
                where: { walletId: wallet.id },
                skip,
                take: pageSize,
                orderBy: { purchasedAt: "desc" },
                include: { avatar: true }
            }),
            prisma.sisyaAvatarPurchase.count({ where: { walletId: wallet.id } })
        ]);

        return res.json({
            success: true,
            data: purchases,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error("Error getting user avatars:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export async function getAvatarPurchases(req: Request, res: Response) {
    try {
        const { avatarId, walletId, page = 1, limit = 50 } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const skip = (pageNumber - 1) * pageSize;

        const where: any = {};
        if (avatarId) where.avatarId = avatarId;
        if (walletId) where.walletId = walletId;

        const [purchases, total] = await Promise.all([
            prisma.sisyaAvatarPurchase.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { purchasedAt: "desc" },
                include: {
                    avatar: true,
                    wallet: {
                        select: {
                            ownerType: true,
                            ownerId: true
                        }
                    }
                }
            }),
            prisma.sisyaAvatarPurchase.count({ where })
        ]);

        return res.json({
            success: true,
            data: purchases,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error("Error getting avatar purchases:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}
