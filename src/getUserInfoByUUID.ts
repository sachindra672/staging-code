import { Request, Response } from 'express'
import { prisma } from "./misc"


export async function getChatInfo(req: Request, res: Response): Promise<void> {
    let { uuidList } = req.body;
    console.log(req.body)
    if (!Array.isArray(uuidList) || uuidList.length === 0) {
        res.status(400).json({ error: 'Invalid UUID list' });
        return;
    }

    uuidList = [...new Set(uuidList)]

    try {
        const endUsers = await prisma.endUsers.findMany({ where: { uuid: { in: uuidList } } });
        const mentors = await prisma.mentor.findMany({ where: { uuid: { in: uuidList } } });
        res.json({ success: true, mentors, endUsers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching chat info.' });
    }
}
