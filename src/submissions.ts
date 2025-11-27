import { Request, Response } from "express"
import { prisma } from "./misc"

export async function GetMySubmissions(req: Request, res: Response) {
    const { endUsersId } = req.body

    try {
        const submissions = await prisma.submission.findMany({ where: { endUsersId } })
        res.json({ success: true, submissions })
    } catch (error) {
        res.status(500).send({ success: false, error })
    }
}