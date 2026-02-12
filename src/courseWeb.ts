import { Request, Response } from 'express';
import { prisma } from './misc'

export const createBigCourseWeb = async (req: Request, res: Response) => {
    try {
        const { bigCourseId, courseDemoPrice, webLabel, courseVideoLink, promoteCourses } = req.body;

        if (!bigCourseId) {
            return res.status(400).json({ error: 'bigCourseId is required' });
        }

        const bigCourseWeb = await prisma.bigCourseWeb.create({
            data: {
                bigCourseId: Number(bigCourseId),
                courseDemoPrice: courseDemoPrice ? Number(courseDemoPrice) : null,
                webLabel,
                courseVideoLink,
                promoteCourses: promoteCourses ? JSON.parse(promoteCourses) : [],
            },
        });

        await prisma.bigCourse.update({
            where: { id: Number(bigCourseId) },
            data: { isWebCreated: true },
        });

        res.status(201).json(bigCourseWeb);
    } catch (err) {
        console.error('Error creating BigCourseWeb:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllBigCourseWeb = async (_req: Request, res: Response) => {
    try {
        const courses = await prisma.bigCourseWeb.findMany({
            include: { subjects: { include: { chapters: true } }, bigCourse: true },
        });
        res.json(courses);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getBigCourseWebById = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;
        const course = await prisma.bigCourseWeb.findUnique({
            where: { id: Number(id) },
            include: { subjects: { include: { chapters: true } }, bigCourse: true },
        });
        if (!course) return res.status(404).json({ error: 'Not Found' });
        res.json(course);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getBigCourseWebByBigCourseId = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;
        const course = await prisma.bigCourseWeb.findUnique({
            where: { bigCourseId: Number(id) },
            include: { subjects: { include: { chapters: true } }, bigCourse: true },
        });
        if (!course) return res.status(404).json({ error: 'Not Found' });
        res.json(course);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateBigCourseWeb = async (req: Request, res: Response) => {
    try {
        const { id,courseDemoPrice, webLabel, courseVideoLink, promoteCourses, createdWeb } = req.body;

        const updated = await prisma.bigCourseWeb.update({
            where: { id: Number(id) },
            data: {
                courseDemoPrice: courseDemoPrice ? Number(courseDemoPrice) : undefined,
                webLabel,
                courseVideoLink,
                promoteCourses: promoteCourses ? JSON.parse(promoteCourses) : undefined,
                createdWeb: createdWeb !== undefined ? Boolean(createdWeb) : undefined,
            },
        });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getBigCourseWebByGrade = async (req: Request, res: Response) => {
    try {
        const { grade } = req.body; 

        if (!grade) {
            return res.status(400).json({ error: 'grade is required' });
        }

        const courses = await prisma.bigCourseWeb.findMany({
            where: {
                bigCourse: {
                    grade: grade,
                },
            },
            include: {
                bigCourse: true,
                subjects: {
                    include: {
                        chapters: {
                            orderBy: { chapterNumber: "asc" }, 
                        },
                    },
                },
            },
        });

        res.json(courses);
    } catch (err) {
        console.error('Error fetching BigCourseWeb by grade:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const createSubjectWeb = async (req: Request, res: Response) => {
    try {
        const { bigCourseWebId, name, taglinePoints, subtitle } = req.body;

        if (!bigCourseWebId || !name) {
            return res.status(400).json({ error: 'bigCourseWebId and name are required' });
        }

        const subject = await prisma.subjectWeb.create({
            data: {
                bigCourseWebId: Number(bigCourseWebId),
                name,
                subtitle,
                taglinePoints: Array.isArray(taglinePoints)
                    ? taglinePoints
                    : taglinePoints
                        ? JSON.parse(taglinePoints)
                        : [],
            },
        });

        res.status(201).json(subject);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getSubjectsByCourseWeb = async (req: Request, res: Response) => {
    try {
        const { bigCourseWebId } = req.body;
        const subjects = await prisma.subjectWeb.findMany({
            where: { bigCourseWebId: Number(bigCourseWebId) },
            include: { chapters: true },
        });
        res.json(subjects);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateSubjectWeb = async (req: Request, res: Response) => {
    try {
        const { id, name, taglinePoints, subtitle } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'id is required' });
        }

        const updated = await prisma.subjectWeb.update({
            where: { id: Number(id) },
            data: {
                name,
                subtitle,
                taglinePoints: Array.isArray(taglinePoints)
                    ? taglinePoints
                    : taglinePoints
                        ? JSON.parse(taglinePoints)
                        : undefined,
            },
        });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const createChapterWeb = async (req: Request, res: Response) => {
    try {
        const { subjectWebId, title, syllabusPoints, chapterNumber } = req.body;

        if (!subjectWebId || !title) {
            return res.status(400).json({ error: 'subjectWebId and title are required' });
        }

        const chapter = await prisma.chapterWeb.create({
            data: {
                subjectWebId: Number(subjectWebId),
                title,
                chapterNumber: Number(chapterNumber),
                syllabusPoints: Array.isArray(syllabusPoints)
                    ? syllabusPoints
                    : syllabusPoints
                        ? JSON.parse(syllabusPoints)
                        : [],
            },
        });

        res.status(201).json(chapter);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getChaptersBySubjectWeb = async (req: Request, res: Response) => {
    try {
        const { subjectWebId } = req.body;

        const chapters = await prisma.chapterWeb.findMany({
            where: { subjectWebId: Number(subjectWebId) },
            orderBy: { chapterNumber: 'asc' }, // ✅ ascending order
        });

        res.json(chapters);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const updateChapterWeb = async (req: Request, res: Response) => {
    try {
        const { id,title, syllabusPoints } = req.body;

        const updated = await prisma.chapterWeb.update({
            where: { id: Number(id) },
            data: {
                title,
                syllabusPoints: Array.isArray(syllabusPoints)
                    ? syllabusPoints
                    : syllabusPoints
                        ? JSON.parse(syllabusPoints)
                        : undefined,
            },
        });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};






