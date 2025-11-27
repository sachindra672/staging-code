import { randomUUID } from 'crypto'
import { prisma } from './misc'
import { Request, Response } from 'express'

export async function SessionStart(req: Request, res: Response) {
    const { sessionId } = req.body
    const roomId = randomUUID()
    try {
        const sessionStreamInfo = await prisma.sessionStreamInfo.create({ data: { sessionId, roomId } })
        await prisma.session.update({ where: { id: sessionId }, data: { isGoingOn: true } })
        res.json({ success: true, sessionStreamInfo })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })
    }
}

export async function EndSession(req: Request, res: Response) {
    const { sessionId } = req.body
    try {
        await prisma.session.update({ where: { id: sessionId }, data: { isGoingOn: false, isDone: true } })
        res.json({ success: true })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })
    }
}