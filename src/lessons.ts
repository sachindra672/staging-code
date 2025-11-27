import { prisma } from './misc'
import { Request, Response } from 'express'

export async function InsertLessons(req: Request, res: Response) {
    const { section, title, description, resourceURL, playTime, coursesId } = req.body
    try {
        const course = await prisma.lessons.create({
            data: {
                title,
                section,
                description,
                resourceURL,
                playTime,
                coursesId
            }
        })
        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export async function UpdateLessons(req: Request, res: Response) {
    const { id, section, title, description, resourceURL, playTime, coursesId } = req.body
    try {
        const course = await prisma.lessons.update({
            where: {
                id
            },
            data: {
                title,
                section,
                description,
                resourceURL,
                playTime,
                coursesId
            }
        })
        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}


export async function GetUsersByBigCourse(req: Request, res: Response) {
    const { bigCourseId } = req.body
    if (!bigCourseId) {
        res.status(400).json({ success: false, message: "invalid course id" })
    }
    try {
        const users = (await prisma.mgSubsciption.findMany({ where: { bigCourseId }, include: { user: true } })).map(e => e.user).map(e => { e.password = ""; return e })

        res.json({ success: true, users })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}