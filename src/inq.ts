import { Request, Response } from 'express'
import { prisma } from './misc'

export async function createInq(req: Request, res: Response) {
    const { name, phone, email, message, isTrialRequest, targetClass, classBoard } = req.body

    try {
        const inq = await prisma.inq.create({ data: { name, phone, email, message, isTrialRequest, targetClass, classBoard } })
        res.json({ success: true, inq })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

export async function getInq(_: Request, res: Response) {
    try {
        const inq = await prisma.inq.findMany()
        res.json({ success: true, inq })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}