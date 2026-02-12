import { prisma } from './misc'
import { Request, Response } from 'express'


export async function GetMyBigCourseStudents(req: Request, res: Response) {
    const { mentorId } = req.body

    try {
        const myBigCourseIds = (await prisma.session.findMany({
            where: { mentorId }, select: { bigCourseId: true }
        })).map(b => b.bigCourseId)

        const endUsers = (await prisma.mgSubsciption.findMany({
            where: { bigCourseId: { in: myBigCourseIds } }, include: { user: true }
        })).map(e => e.user)

        res.json({ success: true, endUsers })
    } catch (error) {
        res.json({ success: false, error })
    }
}

export async function GetMultipleStudentInfo(req: Request, res: Response) {
    const { endUsersIds } = req.body

    try {
        const ids = endUsersIds as number[]
        const studnetInfo = await prisma.endUsers.findMany({ where: { id: { in: ids } } })

        res.json({ success: true, studnetInfo })
    } catch (error) {
        res.json({ success: false, error })
    }
}

export async function getStudentByGrade(req: Request, res: Response) {
    const { grade } = req.body

    try {
        const studnetInfo = await prisma.endUsers.findMany({ where: { grade } })

        res.json({ success: true, studnetInfo })
    } catch (error) {
        res.json({ success: false, error })
    }
}