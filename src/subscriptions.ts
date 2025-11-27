import { Request, Response } from 'express'
import { prisma } from './misc'

export async function InsertSubciption(req: Request, res: Response) {
    const { userId, courseId, status, endDate } = req.body;

    if (!userId || !courseId || status === undefined || !endDate) {
        return res.status(400).send({ success: false, message: "Missing required fields" });
    }

    try {
        const newSubscription = await prisma.subscription.create({
            data: {
                endUsersId: userId,
                ltCoursesId: courseId,
                status: status,
                endDate: new Date(endDate),
                createdOn: new Date(),
                modifiedOn: new Date()
            }
        });
        res.send({ success: true, subscription: newSubscription });
    } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: error });
    }
}

export async function GetMySubscription(req: Request, res: Response) {
    const { endUserId } = req.body;

    if (isNaN(endUserId) || endUserId == 0) return res.status(400).send({ success: false, message: "Missing required courseId parameter" });

    try {
        const subscriptions = await prisma.subscription.findMany({ where: { endUsersId: endUserId }, include: { ltCourses: { include: { subject: { include: { chapters: { include: { topics: true } } } } } }, } });
        res.send({ success: true, subscriptions });
    } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: error });
    }
}