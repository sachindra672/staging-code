import { Request, Response } from "express"
import { prisma } from "./misc"

export async function createAiReview(req: Request, res: Response) {
    try {
        const { rating, review, userId, conversationId } = req.body;

        if(!userId){
            return res.status(400).json({ success: false, message: "userId required" });
        }

        if (!rating || !review) {
            return res.status(400).json({ success: false, message: "Rating and review are required" });
        }

        const newReview = await prisma.aIRating.create({
            data: {
                rating,
                review,
                userId,
                conversationId
            },
        });

        return res.json({ success: true, data: newReview });
    } catch (error) {
        console.error("Error adding review:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}


export async function getAllAiReview(req: Request, res: Response) {
    try {
        const { page = 1, limit = 10 } = req.body || {};

        const pageNumber = Number(page);
        const pageSize = Number(limit);

        if (pageNumber <= 0 || pageSize <= 0) {
            return res.status(400).json({
                success: false,
                message: "Page and limit must be positive numbers",
            });
        }

        const skip = (pageNumber - 1) * pageSize;

        const [reviews, total] = await Promise.all([
            prisma.aIRating.findMany({
                where: { isVisible: true },
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: { id: true, name: true, email: true },
                    },
                },
            }),
            prisma.aIRating.count({ where: { isVisible: true } }),
        ]);

        return res.json({
            success: true,
            data: reviews,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export async function getAllAiReview2(req: Request, res: Response) {
    try {
        const { page = 1, limit = 10 } = req.body || {};

        const pageNumber = Number(page);
        const pageSize = Number(limit);

        if (pageNumber <= 0 || pageSize <= 0) {
            return res.status(400).json({
                success: false,
                message: "Page and limit must be positive numbers",
            });
        }

        const skip = (pageNumber - 1) * pageSize;

        const [reviews, total] = await Promise.all([
            prisma.aIRating.findMany({
                skip,
                take: pageSize,
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: { id: true, name: true, email: true },
                    },
                },
            }),
            prisma.aIRating.count(),
        ]);

        return res.json({
            success: true,
            data: reviews,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
}

export async function toggleAiReviewVisibility(req: Request, res: Response) {
    try {
        const { id } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, message: "Review ID is required" });
        }

        const existingReview = await prisma.aIRating.findUnique({
            where: { id: Number(id) },
            select: { isVisible: true },
        });

        if (!existingReview) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        const updatedReview = await prisma.aIRating.update({
            where: { id: Number(id) },
            data: { isVisible: !existingReview.isVisible },
        });

        return res.json({
            success: true,
            message: "Visibility updated successfully",
            data: updatedReview,
        });
    } catch (error) {
        console.error("Error toggling review visibility:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}