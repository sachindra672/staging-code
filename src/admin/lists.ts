import { prisma } from '../misc'
import { Request, Response } from 'express'

export async function GetMentorList(_: Request, res: Response) {
    try {
        const mentorList = await prisma.mentor.findMany({})
        res.json({ success: true, mentorList })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

export async function GetEndUserList(_: Request, res: Response) {
    try {
        const mentorList = await prisma.endUsers.findMany({})
        res.json({ success: true, mentorList })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}