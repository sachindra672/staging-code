import { Request, Response } from "express";
import { prisma } from "../misc";
import { Decimal } from "@prisma/client/runtime/library";
import { applyTransaction, ensureWallet } from "../config/sisyacoinHelperFunctions";


// get currency active rate
async function getActiveRate(currency: string): Promise<{ coinsPerUnit: Decimal; offerPercent: number | null } | null> {
    const now = new Date();
    const rate = await prisma.sisyaRate.findFirst({
        where: {
            baseCurrency: currency,
            isActive: true,
            effectiveFrom: { lte: now },
            OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: now } }
            ]
        },
        orderBy: { effectiveFrom: "desc" }
    });

    if (!rate) {
        return null;
    }

    return {
        coinsPerUnit: rate.coinsPerUnit,
        offerPercent: rate.offerPercent
    };
}

// initate the fiat purchase 
// middleware se id 
export async function initiateFiatPurchase(req: Request, res: Response) {
    try {
        const { amountFiat, currency, metadata } = req.body;

        if (!amountFiat || !currency) {
            return res.status(400).json({
                success: false,
                message: "amountFiat and currency are required"
            });
        }

        const amountFiatDecimal = new Decimal(amountFiat);
        if (amountFiatDecimal.lte(0)) {
            return res.status(400).json({ success: false, message: "Amount must be positive" });
        }

        const user = req.user;
        const role = req.role;

        if (role !== "user") {
            return res.status(403).json({
                success: false,
                message: "Only end users can purchase coins"
            });
        }

        // middleware se id 
        const userId = user?.user?.id;
        if (!userId) {
            return res.status(400).json({ success: false, message: "User ID not found" });
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

        const wallet = await ensureWallet("ENDUSER", endUser.id);

        // Get active rate
        const rate = await getActiveRate(currency);
        if (!rate) {
            return res.status(400).json({
                success: false,
                message: `No active rate found for currency: ${currency}`
            });
        }

        // Calculate coins to issue
        let coinsIssued = rate.coinsPerUnit.times(amountFiatDecimal);
        if (rate.offerPercent) {
            const bonus = coinsIssued.times(rate.offerPercent).dividedBy(100);
            coinsIssued = coinsIssued.plus(bonus);
        }

        // Create purchase record (status: PENDING)
        const purchase = await prisma.sisyaFiatPurchase.create({
            data: {
                walletId: wallet.id,
                ownerType: "ENDUSER",
                ownerId: endUser.id,
                amountFiat: amountFiatDecimal,
                currency,
                coinsIssued,
                status: "PENDING",
                metadata
            }
        });

        // TODO: Here you would integrate with payment provider (Razorpay, Stripe, etc.)
        // For now, return the purchase record
        // 1. Create payment order with provider
        // 2. Get providerRef and paymentProvider
        // 3. Update purchase with providerRef
        // 4. Return payment details to client

        return res.json({
            success: true,
            data: {
                purchase,
                paymentInfo: {
                    // This would come from payment provider
                    message: "Payment integration needed. Update purchase with providerRef after payment order creation."
                }
            }
        });
    } catch (error) {
        console.error("Error initiating fiat purchase:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Payment webhook
export async function handlePaymentWebhook(req: Request, res: Response) {
    try {
        const { providerRef, signature, status, amount, currency } = req.body;

        if (!providerRef) {
            return res.status(400).json({
                success: false,
                message: "providerRef is required"
            });
        }

        // Find purchase by providerRef
        const purchase = await prisma.sisyaFiatPurchase.findUnique({
            where: { providerRef },
            include: {
                wallet: true
            }
        });

        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }

        if (purchase.status === "COMPLETED") {
            return res.json({
                success: true,
                message: "Purchase already completed"
            });
        }

        // TODO: Verify signature with payment provider
        // verify the webhook is actually from your payment provider

        if (status === "COMPLETED" || status === "success" || status === "paid") {
            // Update purchase status
            await prisma.sisyaFiatPurchase.update({
                where: { id: purchase.id },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    signature: signature || purchase.signature
                }
            });

            // Mint coins into user's wallet
            const balanceBefore = purchase.wallet.spendableBalance;
            const balanceAfter = balanceBefore.plus(purchase.coinsIssued);

            await prisma.sisyaWallet.update({
                where: { id: purchase.walletId },
                data: {
                    spendableBalance: balanceAfter,
                    totalEarned: purchase.wallet.totalEarned.plus(purchase.coinsIssued)
                }
            });

            // Create transaction
            await applyTransaction(
                purchase.walletId,
                "MINT",
                purchase.coinsIssued,
                "SPENDABLE",
                balanceBefore,
                balanceAfter,
                {
                    purchaseId: purchase.id,
                    amountFiat: purchase.amountFiat.toString(),
                    currency: purchase.currency
                },
                undefined,
                purchase.providerRef,
                "SYSTEM",
                undefined
            );

            // Create audit log
            await prisma.sisyaAuditLog.create({
                data: {
                    walletId: purchase.walletId,
                    action: "FIAT_PURCHASE_COMPLETED",
                    actorType: "SYSTEM",
                    actorId: 0,
                    before: balanceBefore,
                    delta: purchase.coinsIssued,
                    after: balanceAfter,
                    note: `Fiat purchase completed: ${purchase.amountFiat} ${purchase.currency} -> ${purchase.coinsIssued} coins`
                }
            });

            return res.json({
                success: true,
                message: "Purchase completed and coins minted"
            });
        } else if (status === "FAILED" || status === "failed" || status === "cancelled") {
            // Update purchase status to failed
            await prisma.sisyaFiatPurchase.update({
                where: { id: purchase.id },
                data: {
                    status: "FAILED"
                }
            });

            return res.json({
                success: true,
                message: "Purchase marked as failed"
            });
        } else {
            // Keep as PENDING
            return res.json({
                success: true,
                message: "Purchase status updated"
            });
        }
    } catch (error) {
        console.error("Error handling payment webhook:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Get my fiat purchases
export async function getMyFiatPurchases(req: Request, res: Response) {
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

        const [purchases, total] = await Promise.all([
            prisma.sisyaFiatPurchase.findMany({
                where: { walletId: wallet.id },
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" }
            }),
            prisma.sisyaFiatPurchase.count({
                where: { walletId: wallet.id }
            })
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
        console.error("Error getting fiat purchases:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Get all fiat purchase - admin ke liye sabhi user ka 
export async function getAllFiatPurchases(req: Request, res: Response) {
    try {
        const { page = 1, limit = 50, status, ownerId } = req.query;

        const pageNumber = Number(page);
        const pageSize = Number(limit);
        const skip = (pageNumber - 1) * pageSize;

        const where: any = {};
        if (status) {
            where.status = status;
        }
        if (ownerId) {
            where.ownerId = parseInt(ownerId as string);
        }

        const [purchases, total] = await Promise.all([
            prisma.sisyaFiatPurchase.findMany({
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
            prisma.sisyaFiatPurchase.count({ where })
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
        console.error("Error getting all fiat purchases:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

