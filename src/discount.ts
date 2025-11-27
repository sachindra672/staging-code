import { Request, Response } from "express"
import { prisma } from "./misc"
import { postDiscountAnnouncement } from "./notifs";

export async function InsertDiscount(req: Request, res: Response) {
    const { bigCourseId, title, type, maxValue, minPurchase, validity, isActive } = req.body;

    if (!bigCourseId || !title || type === undefined || maxValue === undefined || minPurchase === undefined || !validity) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    if (!Number.isInteger(type) || type < 0 || type > 1) {
        return res.status(400).json({ success: false, error: 'Type must be 0 (Fixed) or 1 (Percentage)' });
    }

    if (typeof maxValue !== 'number' || typeof minPurchase !== 'number') {
        return res.status(400).json({ success: false, error: 'maxValue and minPurchase must be numbers' });
    }

    if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, error: 'isActive must be a boolean' });
    }

    if (type === 1 && (maxValue < 0 || maxValue > 100)) {
        return res.status(400).json({ success: false, error: 'Percentage discount must be between 0 and 100' });
    }

    try {
        const discount = await prisma.discount.create({
            data: {
                bigCourseId,
                title,
                type,
                maxValue,
                minPurchase,
                validity: new Date(validity), // Ensure validity is converted to a Date object
                isActive
            }
        });
        const courseName = (await prisma.bigCourse.findFirst({ where: { id: bigCourseId }, select: { name: true } }))?.name
        postDiscountAnnouncement(bigCourseId, `discount on ${courseName}`)

        res.status(201).json({ success: true, discount });
    } catch (error) {
        console.error('Error in InsertDiscount:', error);

        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({ success: false, error: 'Database error', message: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}