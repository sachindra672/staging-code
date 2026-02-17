import { Request, Response } from "express";
import { prisma } from "../misc";
import { invalidateCache } from "../utils/cacheUtils";

export async function createBigCourseBundle(req: Request, res: Response) {
    const { name, bigCourseId, subjectIds, price, currentPrice } = req.body;

    if (!name || !bigCourseId || !subjectIds || price === undefined || currentPrice === undefined) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    try {
        const bundle = await prisma.$transaction(async (tx) => {
            let newBundle = await tx.bigCourseBundle.create({
                data: {
                    name,
                    bigCourseId: Number(bigCourseId),
                    subjectIds: subjectIds.map(Number),
                    price: Number(price),
                    currentPrice: Number(currentPrice),
                }
            });

            newBundle = await tx.bigCourseBundle.update({
                where: { id: newBundle.id },
                data: { appId: 1000 + newBundle.id }
            });

            return newBundle;
        });

        // Invalidate course details cache
        await invalidateCache(`bigCourses:bigCourseDetails:${bigCourseId}`);

        res.status(201).json({ success: true, bundle });
    } catch (error) {
        console.error("createBigCourseBundle error:", error);
        res.status(500).json({ success: false, error });
    }
}

export async function updateBigCourseBundle(req: Request, res: Response) {
    const { id, name, subjectIds, price, currentPrice, isActive } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: "Bundle id is required" });
    }

    try {
        const bundle = await prisma.bigCourseBundle.update({
            where: { id: Number(id) },
            data: {
                ...(name && { name }),
                ...(subjectIds && { subjectIds: subjectIds.map(Number) }),
                ...(price !== undefined && { price: Number(price) }),
                ...(currentPrice !== undefined && { currentPrice: Number(currentPrice) }),
                ...(isActive !== undefined && { isActive }),
                modifiedOn: new Date(),
            }
        });

        // Invalidate course details cache
        await invalidateCache(`bigCourses:bigCourseDetails:${bundle.bigCourseId}`);

        res.json({ success: true, bundle });
    } catch (error) {
        console.error("updateBigCourseBundle error:", error);
        res.status(500).json({ success: false, error });
    }
}

export async function getBigCourseBundles(req: Request, res: Response) {
    const { bigCourseId } = req.body;

    if (!bigCourseId) {
        return res.status(400).json({ success: false, error: "bigCourseId is required" });
    }

    try {
        const bundles = await prisma.bigCourseBundle.findMany({
            where: { bigCourseId: Number(bigCourseId) },
            orderBy: { createdOn: "desc" }
        });

        res.json({ success: true, bundles });
    } catch (error) {
        res.status(500).json({ success: false, error });
    }
}

export async function deleteBigCourseBundle(req: Request, res: Response) {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: "Bundle id is required" });
    }

    try {
        const bundle = await prisma.bigCourseBundle.delete({
            where: { id: Number(id) }
        });

        // Invalidate course details cache
        await invalidateCache(`bigCourses:bigCourseDetails:${bundle.bigCourseId}`);

        res.json({ success: true, message: "Bundle deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error });
    }
}
