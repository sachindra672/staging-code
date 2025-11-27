import { Request, Response } from "express"
import { prisma } from "./misc"

export async function GetMyPurchases(req: Request, res: Response) {
    const { endUsersId } = req.body
    try {
        const course = await prisma.purchases.findMany({
            where: { endUsersId }, include: {
                course: {
                    include: { courseRatings: true, lessons: true }
                }
            }
        })
        res.json({ course })
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export async function CreatePurchase(req: Request, res: Response) {
    const { endUsersId, coursesId } = req.body;
    console.log(req.body)

    if (!endUsersId) return res.status(400).json({ success: false, cause: 'endUsersId is required' });
    if (!coursesId) return res.status(400).json({ success: false, cause: 'coursesId is required' });

    try {
        const purchase = await prisma.purchases.create({ data: { endUsersId, coursesId, orderId: "NA", status: false } });
        res.json({ success: true, purchase });
    } catch (error) {
        console.error('Error creating purchase:', error);
        res.status(500).json({ success: false, cause: error });
    }
}
