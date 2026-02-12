import { prisma } from './misc'
import { Request, Response } from 'express'


export async function getStudentAttendanceRecords(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body

    try {
        const records = await prisma.attendanceRecord.findMany({ where: { endUsersId, bigCourseId } })
        res.json({ success: true, records })
    } catch (error) {
        res.json({ success: false, error })

    }
}

export async function getStudentListBySession(req: Request, res: Response) {
    const { sessionId } = req.body

    try {
        const students = (await prisma.attendanceRecord.findMany({ where: { sessionId }, include: { user: true } })).map(e => e.user)
        res.json({ success: !!students.length, students })
    } catch (error) {
        res.json({ success: false, error })
    }
}

export async function insertAttendanceRecord(req: Request, res: Response) {

    const { endUsersId, bigCourseId, sessionId } = req.body

    try {
        const record = await prisma.attendanceRecord.create({
            data: {
                endUsersId,
                bigCourseId,
                sessionId
            }
        })
        res.json({ success: true, record })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })
    }
}


export async function RecordAttendanceExitTime(req: Request, res: Response) {
    const { id, exitTime } = req.body
    try {
        const record = await prisma.attendanceRecord.update({
            where: { id },
            data: { exitTime }
        })
        res.json({ success: true, record })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })
    }
}