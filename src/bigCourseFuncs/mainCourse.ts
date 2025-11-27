import { Request, Response } from "express"
import { prisma, redis } from "../misc"
import path from "path"
import fs from "fs"


export async function GetBigCourses(req: Request, res: Response) {
    const { isLongTerm } = req.body
    try {
        const courses = await prisma.bigCourse.findMany({
            where: { isLongTerm },
            include:
            {
                discount: true,
                ctest: { include: { ctestQuestions: true } },
                Bgreview: {
                    take: 10,
                    include:
                    {
                        user: { select: { name: true } }
                    }
                },
                TeachIntro: { include: { mentor: true, subject: true } },
                session: {
                    include: {
                        SessionTest:
                        {
                            include:
                            {
                                sessionTestQuestion: true
                            }
                        }
                    }
                }
            }
        })
        res.send({ courses, success: true })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

export async function GetBigCourses2(req: Request, res: Response) {
    const { isLongTerm, isActive } = req.body
    
    try {
        const courses = await prisma.bigCourse.findMany({
            where: {
                ...(isLongTerm !== undefined && { isLongTerm }),
                ...(isActive !== undefined && { isActive }),
            },
            include:
            {
                discount: true,
                ctest: { include: { ctestQuestions: true } },
                Bgreview: {
                    take: 10,
                    include:
                    {
                        user: { select: { name: true } }
                    }
                },
                TeachIntro: { include: { mentor: true, subject: true } },
                session: {
                    include: {
                        SessionTest:
                        {
                            include:
                            {
                                sessionTestQuestion: true
                            }
                        }
                    }
                }
            }
        })
        res.send({ courses, success: true })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

export async function GetBigCourses21(req: Request, res: Response) {
    const { isLongTerm, grade, isActive } = req.body
    try {
        const courses = await prisma.bigCourse.findMany({
            where: {
                ...(isLongTerm !== undefined && { isLongTerm }),
                ...(grade !== undefined && { grade }),
                ...(isActive !== undefined && { isActive }),
            },
        })
        res.send({ courses, success: true })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

export async function GetBigCourses3(req: Request, res: Response) {
    const { isLongTerm, grade, isActive } = req.body;

    const cacheKey = `bigCourses3:isLongTerm=${isLongTerm ?? 'any'}:grade=${grade ?? 'any'}:isActive=${isActive ?? 'any'}`;

    try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            const parsed = JSON.parse(cachedData);
            return res.send({ courses: parsed, success: true, cached: true });
        }

        const courses = await prisma.bigCourse.findMany({
            where: {
                ...(isLongTerm !== undefined && { isLongTerm }),
                ...(grade !== undefined && { grade }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        const allSubjectIds = Array.from(
            new Set(courses.flatMap((course) => course.subjectList || []))
        );

        const subjects = await prisma.subject.findMany({
            where: { id: { in: allSubjectIds } },
            select: { id: true, name: true },
        });

        const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

        const enrichedCourses = courses.map((course) => ({
            ...course,
            subjectListWithNames: (course.subjectList || []).map((id) => ({
                id,
                name: subjectMap.get(id) || null,
            })),
        }));


        await redis.set(cacheKey, JSON.stringify(enrichedCourses), 'EX', 300);

        res.send({ courses: enrichedCourses, success: true, cached: false });
    } catch (error) {
        console.error('GetBigCourses3 error:', error);
        res.status(500).json({ success: false, error: error });
    }
}


export async function GetBigCoursesById(req: Request, res: Response) {
    const { id } = req.body
    try {

        if (!id) { return res.status(400).json({ success: false, error: "id missing" }) }
        const courses = await prisma.bigCourse.findMany({
            where: { id },
            include:
            {
                ctest: { include: { ctestQuestions: true } },
                Bgreview: {
                    take: 10,
                    include:
                    {
                        user: { select: { name: true } }
                    }
                },
                TeachIntro: { include: { mentor: true, subject: true } },
                session: {
                    include: {
                        SessionTest:
                        {
                            include:
                            {
                                sessionTestQuestion: true
                            }
                        }
                    }
                },
                discount: true
            }
        })
        res.send({ courses, success: true })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

export async function GetLongTermCoursesPublicList(_: Request, res: Response) {
    try {
        const sub = await prisma.bigCourse.findMany()
        res.json({ success: true, sub })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, error })
    }
}

export async function getMaterialFilesList(req: Request, res: Response) {
    const { bigCourseId } = req.body;

    if (!bigCourseId) {
        return res.status(400).json({ success: false, error: 'Missing doubtId parameter' });
    }
    try {
        const materialDir = path.join(__dirname, `../../mg_mat/${bigCourseId}`);

        if (!fs.existsSync(materialDir)) {
            return res.status(404).json({ success: false, error: 'Doubt not found or no files uploaded in ', materialDir });
        }
        const files = fs.readdirSync(materialDir);
        res.status(200).json({ success: true, files });
    } catch (error) {
        console.error('Error in getDoubtFiles:', error);
        res.status(500).json({ success: false, error: 'Internal server error', message: error });
    }
}

export async function getMaterialFilesListwithTime(req: Request, res: Response) {
    const { bigCourseId } = req.body;

    if (!bigCourseId) {
        return res.status(400).json({ success: false, error: 'Missing bigCourseId parameter' });
    }

    try {
        const materialDir = path.join(__dirname, `../../mg_mat/${bigCourseId}`);

        if (!fs.existsSync(materialDir)) {
            return res.status(404).json({
                success: false,
                error: 'Material not found or no files uploaded',
                materialDir
            });
        }

        const files = fs.readdirSync(materialDir);
        const fileDetails = files.map(file => {
            const filePath = path.join(materialDir, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                createdAt: stats.birthtime,
                uploadTime: stats.ctime
            };
        });

        fileDetails.sort((a, b) => b.uploadTime.getTime() - a.uploadTime.getTime());

        res.status(200).json({ success: true, files: fileDetails });
    } catch (error) {
        console.error('Error in getMaterialFilesList:', error);
        res.status(500).json({ success: false, error: 'Internal server error', message: error });
    }
}