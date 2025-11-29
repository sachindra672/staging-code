import { Request, Response } from 'express';
import { prisma } from './misc';
import fs from 'fs';
import path from 'path';

export async function InsertLtCourse(req: Request, res: Response) {
    const {
        name,
        description,
        searchTags,
        price,
        currentPrice,
        duration,
        grade,
        mentorId,
        category,
        level,
        thumbnailUrl,
        language,
        prerequisites,
        subjectId
    } = req.body;

    // Check for required fields and provide specific error messages
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!description) return res.status(400).json({ message: 'Description is required' });
    if (!price) return res.status(400).json({ message: 'Price is required' });
    if (!currentPrice) return res.status(400).json({ message: 'Current Price is required' });
    if (!duration) return res.status(400).json({ message: 'Duration is required' });
    if (!grade) return res.status(400).json({ message: 'Grade is required' });
    if (!mentorId) return res.status(400).json({ message: 'Mentor ID is required' });
    if (!category) return res.status(400).json({ message: 'Category is required' });
    if (!level) return res.status(400).json({ message: 'Level is required' });
    if (!thumbnailUrl) return res.status(400).json({ message: 'Thumbnail URL is required' });
    if (!language) return res.status(400).json({ message: 'Language is required' });
    if (!prerequisites) return res.status(400).json({ message: 'Prerequisites are required' });

    const averageRating = 0;
    const enrolledStudents = 0;
    const isActive = true;
    const syllabus = ["standard"];

    try {
        // Create the course with a temporary thumbnail URL
        const newCourse = await prisma.ltCourses.create({
            data: {
                name,
                description,
                searchTags,
                price,
                currentPrice,
                averageRating,
                duration,
                grade,
                mentorId,
                category,
                level,
                enrolledStudents,
                thumbnailUrl: "temp",
                isActive,
                language,
                prerequisites,
                syllabus,
                subjectId
            }
        });

        // Save the thumbnail as a file
        const thumbnailBuffer = Buffer.from(thumbnailUrl, 'base64');
        const thumbnailDir = path.join(__dirname, '../thumbs/ltcourses');
        const thumbnailPath = path.join(thumbnailDir, `${newCourse.id}.jpg`);

        // Create directory if it doesn't exist
        fs.mkdirSync(thumbnailDir, { recursive: true });

        // Write the file
        //@ts-ignore
        fs.writeFileSync(thumbnailPath, thumbnailBuffer);

        // Update the course with the correct thumbnail path
        const updatedCourse = await prisma.ltCourses.update({
            where: { id: newCourse.id },
            data: { thumbnailUrl: thumbnailPath }
        });

        res.status(201).json(updatedCourse);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

/*sample insert json*/
/*
    {
    "name": "Introduction to TypeScript",
    "description": "A comprehensive course on TypeScript.",
    "searchTags": ["typescript", "programming", "javascript"],
    "price": 100.0,
    "currentPrice": 80.0,
    "averageRating": 4.5,
    "duration": 20,
    "grade": 5,
    "mentorId": 1,
    "category": "Programming",
    "level": "Intermediate",
    "enrolledStudents": 200,
    "thumbnailUrl": "<Base64 of image data>",
    "isActive": true,
    "language": "English",
    "prerequisites": ["JavaScript basics"],
    "syllabus": ["Introduction", "Advanced Topics"],
    "schedules": [
        {
            "dayOfWeek": "Monday",
            "startTime": "2024-07-10T09:00:00Z",
            "endTime": "2024-07-10T11:00:00Z"
        },
        {
            "dayOfWeek": "Wednesday",
            "startTime": "2024-07-12T09:00:00Z",
            "endTime": "2024-07-12T11:00:00Z"
        }
    ]
}
*/

export async function UpdateLtCourse(req: Request, res: Response) {
    const { id } = req.params;
    const {
        name,
        description,
        searchTags,
        price,
        currentPrice,
        duration,
        grade,
        mentorId,
        category,
        level,
        thumbnailUrl,
        language,
        prerequisites
    } = req.body;

    if (!id) return res.status(400).json({ message: 'ID is required' });

    try {
        const updateData: any = {};

        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (searchTags) updateData.searchTags = searchTags;
        if (price) updateData.price = price;
        if (currentPrice) updateData.currentPrice = currentPrice;
        if (duration) updateData.duration = duration;
        if (grade) updateData.grade = grade;
        if (mentorId) updateData.mentorId = mentorId;
        if (category) updateData.category = category;
        if (level) updateData.level = level;
        if (language) updateData.language = language;
        if (prerequisites) updateData.prerequisites = prerequisites;

        // Handle thumbnail update
        if (thumbnailUrl) {
            const thumbnailBuffer = Buffer.from(thumbnailUrl, 'base64');
            const thumbnailPath = path.join(__dirname, '../thumbs/ltcourses', `${id}.jpg`);
            //@ts-ignore
            fs.writeFileSync(thumbnailPath, thumbnailBuffer);
            updateData.thumbnailUrl = thumbnailPath;
        }

        // Update course data
        const updatedCourse = await prisma.ltCourses.update({
            where: { id: Number(id) },
            data: updateData
        });

        res.status(200).json(updatedCourse);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

export async function InsertSchedule(req: Request, res: Response) {
    const { courseId, schedules } = req.body;

    if (!courseId) return res.status(400).json({ message: 'Course ID is required' });
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
        return res.status(400).json({ success: false, message: 'Schedules are required and should be an array' });
    }

    for (const schedule of schedules) {
        if (!schedule.dayOfWeek) {
            return res.status(400).json({ success: false, message: 'Each schedule requires a dayOfWeek' });
        }
        if (!schedule.startTime || isNaN(Date.parse(schedule.startTime))) {
            return res.status(400).json({ success: false, message: 'Each schedule requires a valid startTime' });
        }
        if (!schedule.endTime || isNaN(Date.parse(schedule.endTime))) {
            return res.status(400).json({ success: false, message: 'Each schedule requires a valid endTime' });
        }
    }

    try {
        const newSchedules = await prisma.schedule.createMany({
            data: schedules.map((schedule: any) => ({
                courseId: Number(courseId),
                dayOfWeek: schedule.dayOfWeek,
                startTime: new Date(schedule.startTime),
                endTime: new Date(schedule.endTime),
            }))
        });

        res.status(201).json(newSchedules);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

/*{
    "courseId": 1,
    "schedules": [
        {
            "dayOfWeek": "Monday",
            "startTime": "2024-07-10T09:00:00Z",
            "endTime": "2024-07-10T11:00:00Z"
        },
        {
            "dayOfWeek": "Wednesday",
            "startTime": "2024-07-12T09:00:00Z",
            "endTime": "2024-07-12T11:00:00Z"
        }
    ]
}
*/

export async function UpdateSchedule(req: Request, res: Response) {
    const { scheduleId, dayOfWeek, startTime, endTime } = req.body;

    if (!scheduleId) return res.status(400).json({ message: 'Schedule ID is required' });
    if (!dayOfWeek) return res.status(400).json({ message: 'dayOfWeek is required' });
    if (!startTime || isNaN(Date.parse(startTime))) return res.status(400).json({ message: 'Valid startTime is required' });
    if (!endTime || isNaN(Date.parse(endTime))) return res.status(400).json({ message: 'Valid endTime is required' });

    try {
        const updatedSchedule = await prisma.schedule.update({
            where: { id: Number(scheduleId) },
            data: {
                dayOfWeek,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
            }
        });

        res.status(200).json(updatedSchedule);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

export async function DeleteSchedules(req: Request, res: Response) {
    const { scheduleId, scheduleIds } = req.body;

    if (!scheduleId && (!scheduleIds || !Array.isArray(scheduleIds) || scheduleIds.length === 0)) {
        return res.status(400).json({ message: 'Schedule ID or Schedule IDs are required' });
    }

    try {
        if (scheduleId) {
            await prisma.schedule.delete({
                where: { id: Number(scheduleId) }
            });
        }

        if (scheduleIds) {
            await prisma.schedule.deleteMany({ where: { id: { in: scheduleIds.map(Number) } } });
        }

        res.status(200).json({ message: 'Schedule(s) deleted successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

export async function DeleteCourse(req: Request, res: Response) {
    const { courseId } = req.params;

    if (!courseId) return res.status(400).json({ success: false, message: 'Course ID is required' });

    try {
        await prisma.$transaction([
            prisma.schedule.deleteMany({ where: { courseId: Number(courseId) } }),
            prisma.ltCourses.delete({ where: { id: Number(courseId) } })
        ]);

        res.status(200).json({ success: true, message: 'Course and its schedules deleted successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export async function GetLtCourseCatalog(req: Request, res: Response) {
    const { grade } = req.body
    try {
        const catalog = await prisma.ltCourses.findMany({ where: { grade }, include: { subject: { include: { educationBoard: true, chapters: { include: { topics: true } } } } } })
        res.json({ success: true, catalog })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

export async function GetLtCourseCatalogBySubject(req: Request, res: Response) {
    const { grade, subjectId } = req.body

    console.log(grade, subjectId)
    try {
        const catalog = await prisma.ltCourses.findMany({ where: { grade, subjectId }, include: { subject: { include: { educationBoard: true, chapters: { include: { topics: true } } } } } })
        res.json({ success: true, catalog })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, error })
    }
}
