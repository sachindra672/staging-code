import { prisma } from './misc'
import { Request, Response } from 'express'
import { session } from '@prisma/client'

export async function sessionAttendanceList(req: Request, res: Response) {
    const { bigCourseId } = req.body

    try {
        const attendanceRecords = await prisma.attendanceRecord.findMany({ where: { bigCourseId }, })
        const sessions = await prisma.session.findMany({ where: { bigCourseId }, include: { subject: true } })

        const sessionAtendees = new Map<number, number[]>() // sessionID: endUserId[]

        for (const session of sessions) {
            for (const attendanceRecord of attendanceRecords) {
                if (session.id === attendanceRecord.sessionId) {
                    if (!sessionAtendees.has(session.id)) {
                        sessionAtendees.set(session.id, [attendanceRecord.endUsersId])
                    } else {
                        sessionAtendees.get(session.id)?.push(attendanceRecord.endUsersId)
                    }
                }
            }
        }
        const nueSession = []
        for (const sessionAtendeeListPair of sessionAtendees) { // [sessionID, endUserId[]]
            for (const session of sessions) {
                if (session.id == sessionAtendeeListPair[0]) {
                    nueSession.push({ ...session, atendeeList: sessionAtendeeListPair[1] })
                }
            }
        }

        res.json({ success: true, list: nueSession })
    } catch (error) {
        console.log(error)
        res.json({ success: true, error })

    }
}

export async function GetMyAttendanceProgressReport(req: Request, res: Response) {
    const { bigCourseId, endUsersId } = req.body

    try {
        const attendanceRecords = await prisma.attendanceRecord.findMany({ where: { bigCourseId, endUsersId }, })
        const sessionsAttended = attendanceRecords.map(e => e.sessionId)
        const sessions = await prisma.session.findMany({ where: { bigCourseId, id: { in: sessionsAttended } }, include: { subject: true } })
        const SubjetcIdToSession = new Map<number, session[]>()

        for (const session of sessions) {
            if (SubjetcIdToSession.has(session.subject.id)) {
                SubjetcIdToSession.get(session.subject.id)?.push(session)
            } else {
                SubjetcIdToSession.set(session.subject.id, [session])
            }
        }

        res.json({ success: true, list: Object.fromEntries(SubjetcIdToSession) })
    } catch (error) {
        console.log(error)
        res.json({ success: true, error })

    }
}

export const getSessionAttendanceList = async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "sessionId is required"
            });
        }

        const attendanceList = await prisma.attendanceRecord.findMany({
            where: {
                sessionId: Number(sessionId)
            },
            orderBy: {
                createdOn: "asc" // join order
            },
            select: {
                id: true,
                createdOn: true,
                exitTime: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                }
            }
        });

        const formatted = attendanceList.map(record => ({
            attendanceId: record.id,
            studentId: record.user.id,
            studentName: record.user.name,
        }));

        res.status(200).json({
            success: true,
            totalStudents: formatted.length,
            data: formatted
        });

    } catch (error) {
        console.error("getSessionAttendanceList error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


