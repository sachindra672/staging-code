import { Request, Response } from "express"
import { prisma, redis } from "../misc"
import path from "path"
import fs from "fs"
import { getCache, setCache, invalidateCache } from '../utils/cacheUtils';
import { getUserSubjectFilter } from "../utils/subscriptionUtils";

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

export async function GetBigCoursesNew(req: Request, res: Response) {
    let { isLongTerm, isActive, grade } = req.body;

    if (isActive === undefined) isActive = true;

    const cacheKey = `bigCourses:isActive=${isActive}:isLongTerm=${isLongTerm ?? "all"}:grade=${grade ?? "all"}`;

    try {
        const cachedCourses = await getCache(cacheKey);
        if (cachedCourses) {
            return res.json({
                success: true,
                courses: cachedCourses,
                source: "cache",
            });
        }

        const courses = await prisma.bigCourse.findMany({
            where: {
                isActive,
                ...(isLongTerm !== undefined && { isLongTerm }),
                ...(grade && { grade }),
            },
            select: {
                id: true,
                name: true,
                grade: true,
                level: true,
                price: true,
                currentPrice: true,
                partialPrice: true,
                isLongTerm: true,
                isFree: true,
                startDate: true,
                endDate: true,
                averageRating: true,
                isActive: true,
            },
        });

        await setCache(cacheKey, courses, 43200); // 12 hours

        res.json({
            success: true,
            courses,
            source: "db",
        });
    } catch (error) {
        res.status(500).json({ success: false, error });
    }
}

export async function GetBigCourseNewDetails(req: Request, res: Response) {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: "id missing" });
    }

    const cacheKey = `bigCourses:bigCourseDetails:${id}`;

    try {
        const cachedCourse = await getCache(cacheKey);
        if (cachedCourse) {
            return res.json({
                success: true,
                course: cachedCourse,
                source: "cache",
            });
        }

        const course = await prisma.bigCourse.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                description: true,
                price: true,
                currentPrice: true,
                partialPrice: true,
                averageRating: true,
                mentorList: true,
                subjectList: true,
            }
        });

        if (!course) {
            return res.status(404).json({ success: false, error: "Course not found" });
        }

        const [mentors, subjects, bundles] = await Promise.all([
            course.mentorList.length
                ? prisma.mentor.findMany({
                    where: { id: { in: course.mentorList } },
                    select: { id: true, name: true },
                })
                : Promise.resolve([]),

            course.subjectList.length
                ? prisma.subject.findMany({
                    where: { id: { in: course.subjectList } },
                    select: { id: true, name: true },
                })
                : Promise.resolve([]),

            prisma.bigCourseBundle.findMany({
                where: { bigCourseId: id, isActive: true }
            })
        ]);

        const response = {
            id: course.id,
            name: course.name,
            description: course.description,
            price: course.price,
            currentPrice: course.currentPrice,
            partialPrice: course.partialPrice,
            mentors: mentors,
            subjects: subjects,
            bundles: bundles,
        };

        await setCache(cacheKey, response, 43200); // 12 hours

        res.json({
            success: true,
            course: response,
            source: "db",
        });
    } catch (error) {
        res.status(500).json({ success: false, error });
    }
}

export async function GetBigCoursesLesson(req: Request, res: Response) {
    const { id, page = 1 } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: "id missing" });
    }

    const LIMIT = 500;
    const offset = (Number(page) - 1) * LIMIT;

    const subjectFilter = await getUserSubjectFilter(req.user, req.role, id);
    const filterKey = JSON.stringify(subjectFilter);
    const cacheKey = `bigCourses:lessons:${id}:page:${page}:filter:${filterKey}`;

    try {
        const cachedLessons = await getCache(cacheKey);
        if (cachedLessons) {
            return res.json({
                success: true,
                lessons: cachedLessons.lessons,
                pagination: cachedLessons.pagination,
                source: "cache",
            });
        }

        const [lessons, totalCount] = await Promise.all([
            prisma.session.findMany({
                where: {
                    bigCourseId: id,
                    ...subjectFilter,
                },
                select: {
                    id: true,
                    detail: true,
                    duration: true,
                    startTime: true,
                    endTime: true,
                    mentor: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    subject: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    startTime: "desc",
                },
                skip: offset,
                take: LIMIT,
            }),
            prisma.session.count({
                where: {
                    bigCourseId: id,
                    ...subjectFilter,
                },
            }),
        ]);

        const response = lessons.map((lesson) => ({
            id: lesson.id,
            detail: lesson.detail,
            duration: lesson.duration,
            startTime: lesson.startTime,
            endTime: lesson.endTime,
            mentor: lesson.mentor,
            subject: lesson.subject,
        }));

        const pagination = {
            page: Number(page),
            limit: LIMIT,
            total: totalCount,
            totalPages: Math.ceil(totalCount / LIMIT),
            hasNext: offset + LIMIT < totalCount,
        };

        const cachePayload = {
            lessons: response,
            pagination,
        };

        await setCache(cacheKey, cachePayload, 900);

        res.json({
            success: true,
            lessons: response,
            pagination,
            source: "db",
        });
    } catch (error) {
        console.error("GetBigCoursesLesson error:", error);
        res.status(500).json({ success: false, error });
    }
}

export async function GetUpcomingSessions(req: Request, res: Response) {
    const { id, page = 1 } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: "id missing" });
    }

    const LIMIT = 20;
    const offset = (Number(page) - 1) * LIMIT;

    const subjectFilter = await getUserSubjectFilter(req.user, req.role, id);
    const filterKey = JSON.stringify(subjectFilter);
    const cacheKey = `bigCourses:upcomingSessions:${id}:page:${page}:filter:${filterKey}`;

    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                sessions: cached.sessions,
                pagination: cached.pagination,
                source: "cache",
            });
        }

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [sessions, total] = await Promise.all([
            prisma.session.findMany({
                where: {
                    bigCourseId: id,
                    isDone: false,
                    startTime: {
                        gte: startOfToday,
                    },
                    ...subjectFilter,
                },
                select: {
                    id: true,
                    detail: true,
                    startTime: true,
                    endTime: true,
                    isGoingOn: true,
                    vmIp: true,
                    subject: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    mentor: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    startTime: "desc",
                },
                skip: offset,
                take: LIMIT,
            }),

            prisma.session.count({
                where: {
                    bigCourseId: id,
                    isDone: false,
                    ...subjectFilter,
                },
            }),
        ]);

        const pagination = {
            page: Number(page),
            limit: LIMIT,
            hasNext: offset + LIMIT < total,
        };

        const payload = {
            sessions,
            pagination,
        };

        await setCache(cacheKey, payload, 900);

        return res.json({
            success: true,
            sessions,
            pagination,
            source: "db",
        });
    } catch (error) {
        console.error("GetUpcomingSessions error:", error);
        return res.status(500).json({ success: false, error });
    }
}

export async function GetTodaySessions(req: Request, res: Response) {
    const { id, page = 1 } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: "id missing" });
    }

    const LIMIT = 20;
    const offset = (Number(page) - 1) * LIMIT;

    const subjectFilter = await getUserSubjectFilter(req.user, req.role, id);
    const filterKey = JSON.stringify(subjectFilter);
    const cacheKey = `bigCourses:todaySessions:${id}:page:${page}:filter:${filterKey}`;

    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                sessions: cached.sessions,
                pagination: cached.pagination,
                ongoingCount: cached.ongoingCount,
                source: "cache",
            });
        }

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const [sessions, total, ongoingSessions] = await Promise.all([
            prisma.session.findMany({
                where: {
                    bigCourseId: id,
                    isDone: false,
                    ...subjectFilter,
                    OR: [
                        {
                            startTime: {
                                gte: startOfToday,
                                lte: endOfToday,
                            },
                        },
                        {
                            isGoingOn: true,
                        },
                    ],
                },
                select: {
                    id: true,
                    detail: true,
                    startTime: true,
                    endTime: true,
                    isGoingOn: true,
                    vmIp: true,
                    subject: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    mentor: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    startTime: "asc",
                },
                skip: offset,
                take: LIMIT,
            }),

            prisma.session.count({
                where: {
                    bigCourseId: id,
                    isDone: false,
                    ...subjectFilter,
                    OR: [
                        {
                            startTime: {
                                gte: startOfToday,
                                lte: endOfToday,
                            },
                        },
                        {
                            isGoingOn: true,
                        },
                    ],
                },
            }),

            prisma.session.findMany({
                where: {
                    bigCourseId: id,
                    isDone: false,
                    isGoingOn: true,
                    ...subjectFilter,
                },
                select: {
                    id: true,
                },
            }),
        ]);

        const pagination = {
            page: Number(page),
            limit: LIMIT,
            hasNext: offset + LIMIT < total,
        };

        const payload = {
            sessions,
            pagination,
            ongoingCount: ongoingSessions.length,
        };

        await setCache(cacheKey, payload, 300);

        return res.json({
            success: true,
            sessions,
            pagination,
            ongoingCount: ongoingSessions.length,
            source: "db",
        });
    } catch (error) {
        console.error("GetTodaySessions error:", error);
        return res.status(500).json({ success: false, error });
    }
}

export async function GetCompletedSessions(req: Request, res: Response) {
    const { id, page = 1 } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: "id missing" });
    }

    const LIMIT = 20;
    const offset = (Number(page) - 1) * LIMIT;

    const subjectFilter = await getUserSubjectFilter(req.user, req.role, id);
    const filterKey = JSON.stringify(subjectFilter);
    const cacheKey = `bigCourses:completedSessions:${id}:page:${page}:filter:${filterKey}`;

    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                sessions: cached.sessions,
                pagination: cached.pagination,
                source: "cache",
            });
        }

        const [sessions, total] = await Promise.all([
            prisma.session.findMany({
                where: {
                    bigCourseId: id,
                    isDone: true,
                    ...subjectFilter,
                },
                select: {
                    id: true,
                    detail: true,
                    startTime: true,
                    endTime: true,
                    vmIp: true,
                    hostRecordingUrl: true,
                    screenRecordingUrl: true,
                    recordingUrl: true,
                    isNewRecording: true,
                    screenRecordingTimeStamp: true,
                    sessionStartTime: true,
                    subject: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    mentor: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    startTime: "desc",
                },
                skip: offset,
                take: LIMIT,
            }),

            prisma.session.count({
                where: {
                    bigCourseId: id,
                    isDone: true,
                    ...subjectFilter,
                },
            }),
        ]);

        const pagination = {
            page: Number(page),
            limit: LIMIT,
            hasNext: offset + LIMIT < total,
        };

        const payload = {
            sessions,
            pagination,
        };

        await setCache(cacheKey, payload, 900);

        return res.json({
            success: true,
            sessions,
            pagination,
            source: "db",
        });
    } catch (error) {
        console.error("GetCompletedSessions error:", error);
        return res.status(500).json({ success: false, error });
    }
}

export async function GetSessionRecordings(req: Request, res: Response) {
    const { id, page = 1 } = req.body; // bigCourseId

    if (!id) {
        return res.status(400).json({ success: false, error: "id missing" });
    }

    const LIMIT = 20;
    const offset = (Number(page) - 1) * LIMIT;

    const subjectFilter = await getUserSubjectFilter(req.user, req.role, id);
    const filterKey = JSON.stringify(subjectFilter);
    const cacheKey = `bigCourses:recordings:${id}:page:${page}:filter:${filterKey}`;

    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                recordings: cached.recordings,
                pagination: cached.pagination,
                source: "cache",
            });
        }

        const [recordings, total] = await Promise.all([
            prisma.session.findMany({
                where: {
                    bigCourseId: id,
                    isDone: true,
                    ...subjectFilter,
                    OR: [
                        { recordingUrl: { not: null } },
                        { screenRecordingUrl: { not: null } },
                        { hostRecordingUrl: { not: null } },
                    ],
                },
                select: {
                    id: true,
                    detail: true,
                    startTime: true,
                    endTime: true,
                    recordingUrl: true,
                    hostRecordingUrl: true,
                    screenRecordingUrl: true,
                    isNewRecording: true,
                    sessionStartTime: true,
                    screenRecordingTimeStamp: true,
                    subject: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    startTime: "desc",
                },
                skip: offset,
                take: LIMIT,
            }),

            prisma.session.count({
                where: {
                    bigCourseId: id,
                    isDone: true,
                    ...subjectFilter,
                    OR: [
                        { recordingUrl: { not: null } },
                        { screenRecordingUrl: { not: null } },
                        { hostRecordingUrl: { not: null } },
                    ],
                },
            }),
        ]);

        const pagination = {
            page: Number(page),
            limit: LIMIT,
            hasNext: offset + LIMIT < total,
        };

        const payload = {
            recordings,
            pagination,
        };

        await setCache(cacheKey, payload, 900); // 15 min

        return res.json({
            success: true,
            recordings,
            pagination,
            source: "db",
        });
    } catch (error) {
        console.error("GetSessionRecordings error:", error);
        return res.status(500).json({ success: false, error });
    }
}

export async function SearchSessionRecordings(req: Request, res: Response) {
    const {
        id,
        query = "",
        subjectId,
        fromDate,
        toDate,
        page = 1,
    } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: "id missing" });
    }

    const LIMIT = 20;
    const offset = (Number(page) - 1) * LIMIT;

    const normalizedQuery = query.trim().toLowerCase();

    const subjectFilter = await getUserSubjectFilter(req.user, req.role, id);
    const filterKey = JSON.stringify(subjectFilter);
    const cacheKey = `bigCourses:recordings:search:${id}:${normalizedQuery}:${subjectId || "all"}:${fromDate || "na"}:${toDate || "na"}:page:${page}:filter:${filterKey}`;

    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                recordings: cached.recordings,
                pagination: cached.pagination,
                source: "cache",
            });
        }

        const where: any = {
            bigCourseId: id,
            isDone: true,
            ...subjectFilter,
            OR: [
                { recordingUrl: { not: null } },
                { screenRecordingUrl: { not: null } },
                { hostRecordingUrl: { not: null } },
            ],
        };

        if (normalizedQuery) {
            where.AND = [
                {
                    OR: [
                        {
                            detail: {
                                contains: normalizedQuery,
                                mode: "insensitive",
                            },
                        },
                        {
                            mentor: {
                                name: {
                                    contains: normalizedQuery,
                                    mode: "insensitive",
                                },
                            },
                        },
                        {
                            subject: {
                                name: {
                                    contains: normalizedQuery,
                                    mode: "insensitive",
                                },
                            },
                        },
                    ],
                },
            ];
        }

        if (subjectId) {
            where.subjectId = Number(subjectId);
        }

        if (fromDate || toDate) {
            where.startTime = {};
            if (fromDate) where.startTime.gte = new Date(fromDate);
            if (toDate) where.startTime.lte = new Date(toDate);
        }

        const [recordings, total] = await Promise.all([
            prisma.session.findMany({
                where,
                select: {
                    id: true,
                    detail: true,
                    startTime: true,
                    endTime: true,
                    recordingUrl: true,
                    hostRecordingUrl: true,
                    screenRecordingUrl: true,
                    isNewRecording: true,
                    sessionStartTime: true,
                    screenRecordingTimeStamp: true,
                    mentor: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    subject: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    startTime: "desc",
                },
                skip: offset,
                take: LIMIT,
            }),

            prisma.session.count({ where }),
        ]);

        const pagination = {
            page: Number(page),
            limit: LIMIT,
            hasNext: offset + LIMIT < total,
        };

        const payload = { recordings, pagination };

        await setCache(cacheKey, payload, 900); // 15 min TTL

        return res.json({
            success: true,
            recordings,
            pagination,
            source: "db",
        });
    } catch (error) {
        console.error("SearchSessionRecordings error:", error);
        return res.status(500).json({ success: false, error });
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
                ctest: { include: { ctestQuestions: true, imageQuestions: true } },
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

export async function GetCompletedSessionsAdmin(req: Request, res: Response) {
    const {
        id,
        page = 1,
        startDate,
        endDate,
        search = ""
    } = req.body;

    if (!id) {
        return res.status(400).json({
            success: false,
            error: "id missing",
        });
    }

    const LIMIT = 20;
    const offset = (Number(page) - 1) * LIMIT;

    try {
        const whereClause: any = {
            bigCourseId: id,
            isDone: true,
        };

        if (startDate || endDate) {
            whereClause.startTime = {};

            if (startDate) {
                whereClause.startTime.gte = new Date(startDate);
            }

            if (endDate) {
                whereClause.startTime.lte = new Date(endDate);
            }
        }

        if (search.trim()) {
            whereClause.OR = [
                {
                    detail: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    subject: {
                        name: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                },
                {
                    mentor: {
                        name: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                },
            ];
        }

        const [sessions, total] = await Promise.all([
            prisma.session.findMany({
                where: whereClause,

                select: {
                    id: true,
                    detail: true,

                    // Scheduled
                    startTime: true,
                    endTime: true,

                    subject: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },

                    mentor: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },

                    // Homework
                    SessionTest: {
                        select: {
                            id: true,
                        },
                    },

                    // Actual analytics
                    analytics: {
                        select: {
                            classStartTime: true,
                            classEndTime: true,
                            actualDuration: true,

                            teacherAttendance: {
                                select: {
                                    teacher: {
                                        select: {
                                            id: true,
                                            name: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },

                orderBy: {
                    startTime: "desc",
                },

                skip: offset,
                take: LIMIT,
            }),

            prisma.session.count({
                where: whereClause,
            }),
        ]);

        const formattedSessions = sessions.map((s) => ({
            id: s.id,
            detail: s.detail,

            // Scheduled
            scheduledStartTime: s.startTime,
            scheduledEndTime: s.endTime,
            scheduledDuration:
                (new Date(s.endTime).getTime() -
                    new Date(s.startTime).getTime()) /
                (1000 * 60),

            scheduledTeacher: s.mentor,

            subject: s.subject,

            // Homework
            isHomeworkUploaded: s.SessionTest.length > 0,

            // Actual
            actualStartTime: s.analytics?.classStartTime || null,
            actualEndTime: s.analytics?.classEndTime || null,
            actualDuration: s.analytics?.actualDuration || null,

            actualTeacher:
                s.analytics?.teacherAttendance?.teacher || null,
        }));

        const pagination = {
            page: Number(page),
            limit: LIMIT,
            total,
            hasNext: offset + LIMIT < total,
        };

        return res.json({
            success: true,
            sessions: formattedSessions,
            pagination,
        });

    } catch (error) {
        console.error("GetCompletedSessionsAdmin error:", error);

        return res.status(500).json({
            success: false,
            error: "Internal Server Error",
        });
    }
}