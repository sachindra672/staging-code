import { prisma } from './misc'
import { Request, Response } from 'express'
import { generateToken04 } from './zego';
import { read } from 'fs';


const appId = 1500762473; // Your App ID
const serverSecret = "175fa0e5958efde603f2ec805c7d6120";
const effectiveTimeOut = 1 * 60 * 60 * 24

export async function InsertPtm(req: Request, res: Response) {
    const { eventDate, bigCourseId } = req.body

    try {
        const ptm = await prisma.ptmSession.create({ data: { eventDate, bigCourseId } })
        res.json({ success: true, ptm })
    } catch (error) {
        console.log(error)
        res.json({ succcess: false, message: error })
    }
}

export async function startPtm(req: Request, res: Response) {
    const { id, mentorId } = req.body

    try {
        const streamToken = generateToken04(appId, mentorId, serverSecret, effectiveTimeOut)
        const newPtm = await prisma.ptmSession.update({ where: { id }, data: { streamToken } })
        res.json({ success: true, newPtm })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error })
    }
}

export async function endPtm(req: Request, res: Response) {
    const { id } = req.body

    try {
        const newPtm = await prisma.ptmSession.update({ where: { id }, data: { isDone: true, isGoingOn: false, streamToken: "" } })
        res.json({ success: true, newPtm })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error })
    }
}

export async function GetStudentPtms(req: Request, res: Response) {
    const { endUsersId } = req.body

    if (!endUsersId) {
        res.status(401).json({ success: false, message: "missing input" })
    }

    try {
        const ptms = (await prisma.mgSubsciption.findMany({ where: { endUsersId }, include: { course: { include: { PtmSession: true } } } }))
            .map(e => e.course)
            .map(e => e.PtmSession)
        res.json({ success: true, ptms })

    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error })
    }
}


export async function AddRoomIdtoPtm(req: Request, res: Response) {
    const { id, roomId } = req.body

    try {
        const newPtm = await prisma.ptmSession.update({ where: { id }, data: { roomId, isGoingOn: true } })
        res.json({ success: true, newPtm })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error })
    }
}