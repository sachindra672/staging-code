import { prisma } from '../misc'
import { Request, Response } from 'express'

export async function GetPagedStudentList(req: Request, res: Response) {
    const { id, amount } = req.body;



    if (id === undefined || amount === undefined) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const idNumber = Number(id);
    const amountNumber = Number(amount);

    if (isNaN(idNumber) || idNumber < 0) {
        return res.status(400).json({ success: false, error: 'Invalid id format' });
    }

    if (isNaN(amountNumber) || amountNumber <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid amount format' });
    }

    try {
        const studentList = await prisma.endUsers.findMany({
            where: { id: { gt: idNumber } },
            // take: amountNumber,
            orderBy: { id: 'asc' }
        });

        if (id == 0) {
            const count = await prisma.endUsers.count()
            return res.status(200).json({ success: true, studentList, count });
        }
        res.status(200).json({ success: true, studentList });
    } catch (error) {
        console.error('Error in GetPagedStudentList:', error);

        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({
                    success: false,
                    error: 'Database error',
                    message: error.message
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Internal server error',
                    message: error.message
                });
            }
        } else {
            res.status(500).json({
                success: false,
                error: 'An unexpected error occurred'
            });
        }
    }
}

export async function GetAllMentors(_req: Request, res: Response) {
    try {
        const mentors = await prisma.mentor.findMany({ include: { subjectRecord: { include: { subject: true } }, qualifications: true } })
        res.json({ success: true, mentors })
    } catch (error) {
        console.error('Error in GetPagedStudentList:', error);

        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({
                    success: false,
                    error: 'Database error',
                    message: error.message
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Internal server error',
                    message: error.message
                });
            }
        } else {
            res.status(500).json({
                success: false,
                error: 'An unexpected error occurred'
            });
        }
    }
}

export async function GetAllCourses(_req: Request, res: Response) {
    try {
        const courses = await prisma.bigCourse.findMany({ include: { TeachIntro: true, session: true } })
        res.json({ success: true, courses })

    } catch (error) {
        console.error('Error in GetPagedStudentList:', error);

        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({
                    success: false,
                    error: 'Database error',
                    message: error.message
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Internal server error',
                    message: error.message
                });
            }
        } else {
            res.status(500).json({
                success: false,
                error: 'An unexpected error occurred'
            });
        }
    }
}