import { prisma } from './misc'
import { Request, Response } from 'express'
import fs from 'fs';
import path from 'path';

export async function InsertCourse(req: Request, res: Response) {
    const { mentorId, comment, name, price, currentPrice, searchTags, grade, imageData, Subject } = req.body;
    const rating = 0.0;

    if (!mentorId) {
        return res.status(400).json({ success: false, cause: 'mentorId is required' });
    }
    if (!comment) {
        return res.status(400).json({ success: false, cause: 'comment is required' });
    }
    if (!name) {
        return res.status(400).json({ success: false, cause: 'name is required' });
    }
    if (price == null) {
        return res.status(400).json({ success: false, cause: 'price is required' });
    }
    if (currentPrice == null) {
        return res.status(400).json({ success: false, cause: 'currentPrice is required' });
    }
    if (!searchTags || !Array.isArray(searchTags)) {
        return res.status(400).json({ success: false, cause: 'searchTags must be a non-empty array' });
    }
    if (grade == null) {
        return res.status(400).json({ success: false, cause: 'grade is required' });
    }
    if (!imageData) {
        return res.status(400).json({ success: false, cause: 'imageData is required' });
    }

    try {
        // Create the course
        const course = await prisma.courses.create({
            data: {
                rating,
                mentorId,
                comment,
                name,
                price,
                currentPrice,
                searchTags,
                grade,
                Subject
            }
        });

        const imageBuffer = Buffer.from(imageData, 'base64');
        const imageDir = path.join(__dirname, '../thumbs/courses');
        const imagePath = path.join(imageDir, `${course.id}.jpg`);

        fs.mkdirSync(imageDir, { recursive: true });
        fs.writeFileSync(imagePath, imageBuffer);

        res.json({ succes: true, course });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error });
    }
}
export async function UpdateCourse(req: Request, res: Response) {
    const { id, comment, name, price, currentPrice, searchTags, grade } = req.body

    try {
        const course = await prisma.courses.update({
            where: {
                id
            },
            data: {
                comment,
                name,
                price,
                currentPrice,
                searchTags,
                grade
            }
        })
        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export async function GetCourseDetail(req: Request, res: Response) {
    const { id } = req.body

    try {
        const course = await prisma.courses.findUnique({ where: { id }, include: { courseRatings: true, lessons: true } })

        res.json({ success: true, course })
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export async function GetCoursesByGrade(req: Request, res: Response) {
    const { grade } = req.body
    console.log(req.body)

    if (!grade) {
        return res.status(400).send("invalid grade")
    }

    try {
        const course = await prisma.courses.findMany({ where: { grade }, include: { lessons: true } })

        return res.json({ success: true, course })
    } catch (error) {
        return res.json({ success: false, cause: error })
    }
}

export async function InsertCourseRating(req: Request, res: Response) {
    const { title, subject, userId, coursesId } = req.body
    const averageRating = 0.0
    try {
        const course = await prisma.courseRatings.create({
            data: {
                title,
                subject,
                averageRating,
                userId,
                coursesId
            }
        })
        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export async function UpdateCourseRating(req: Request, res: Response) {
    const { id, title, subject, coursesId } = req.body
    const averageRating = 0.0
    try {
        const course = await prisma.courseRatings.update({
            where: { id },
            data: {
                title,
                subject,
                averageRating,
                coursesId
            }
        })
        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export async function GetTeacherCourses(req: Request, res: Response) {
    const { mentorId } = req.body
    try {
        const course = await prisma.courseRatings.findMany({ where: { mentorId } })
        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}