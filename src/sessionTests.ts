
import { prisma } from './misc'
import { Request, Response } from 'express'
import { getCache, setCache, invalidateCache } from './utils/cacheUtils';


export async function InsertSessionTests(req: Request, res: Response) {
    const { startTime, endTime, duration, sessionId, mentorId, questions } = req.body;

    if (!startTime || !endTime || !duration || !sessionId || !mentorId || !Array.isArray(questions)) {
        return res.status(400).json({ success: false, error: 'Missing or invalid required fields' });
    }

    try {
        if (questions.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one question is required' });
        }

        const sessionTest = await prisma.sessionTest.create({
            data: {
                startTime,
                endTime,
                mentorId,
                duration,
                sessionId,
                sessionTestQuestion: {
                    create: questions.map((question: any) => {
                        return { ...question };
                    })
                }
            },
            include: {
                sessionTestQuestion: true
            }
        });

        // Invalidate cache for session test questions
        await invalidateCache(`sessionTest:questions:${sessionTest.id}`);

        res.status(201).json({ success: true, sessionTest });
    } catch (error) {
        console.error('Error in InsertSessionTests:', error);

        if (error instanceof Error) {
            if (error.message === 'Invalid question object') {
                res.status(400).json({ success: false, error: 'Invalid question format in the questions array' });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}

enum QType {
    multipleChoice = "multipleChoice",
    trueFalse = "trueFalse"
}

export async function InsertSessionTests2(req: Request, res: Response) {
    const { duration, sessionId, mentorId, questions } = req.body;

    if (!duration || !sessionId || !mentorId || !Array.isArray(questions)) {
        return res.status(400).json({ success: false, error: 'Missing or invalid required fields' });
    }

    try {
        if (questions.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one question is required' });
        }

        // Get session to fetch endTime
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { endTime: true }
        });

        if (!session) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        // Calculate test timing:
        // startTime = session's endTime
        // endTime = session's endTime + 24 hours
        const startTime = new Date(session.endTime);
        const endTime = new Date(session.endTime);
        endTime.setHours(endTime.getHours() + 24); // Add 24 hours

        const sessionTest = await prisma.sessionTest.create({
            data: {
                startTime,
                endTime,
                mentorId,
                duration,
                sessionId,
                sessionTestQuestion: {
                    create: questions.map((question: any) => {
                        return { ...question };
                    })
                }
            },
            include: {
                sessionTestQuestion: true
            }
        });

        // Invalidate cache for session test questions
        await invalidateCache(`sessionTest:questions:${sessionTest.id}`);

        res.status(201).json({ success: true, sessionTest });
    } catch (error) {
        console.error('Error in InsertSessionTests2:', error);

        if (error instanceof Error) {
            if (error.message === 'Invalid question object') {
                res.status(400).json({ success: false, error: 'Invalid question format in the questions array' });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}

export async function InsertSessionTestQuestions(req: Request, res: Response) {
    const { sessionTestId, type, question, option1, option2, option3, option4, correctResponse } = req.body;

    if (!sessionTestId || !type || !question || !correctResponse) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    if (!Object.values(QType).includes(type as QType)) {
        return res.status(400).json({ success: false, error: 'Invalid question type' });
    }

    if (type === QType.multipleChoice && (!option1 || !option2)) {
        return res.status(400).json({ success: false, error: 'Multiple choice questions require at least two options' });
    }

    if (type === QType.trueFalse && (option1 !== 'True' || option2 !== 'False')) {
        return res.status(400).json({ success: false, error: 'True/False questions must have "True" and "False" as options' });
    }

    try {
        const sessionTestQuestion = await prisma.sessionTestQuestion.create({
            data: {
                sessionTestId,
                type,
                question,
                option1: option1 || null,
                option2: option2 || null,
                option3: option3 || null,
                option4: option4 || null,
                correctResponse
            }
        });

        // Invalidate cache for session test questions
        await invalidateCache(`sessionTest:questions:${sessionTestId}`);

        res.status(201).json({ success: true, sessionTestQuestion });
    } catch (error) {
        console.error('Error in InsertSessionTestQuestions:', error);

        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({ success: false, error: 'Database error', message: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}

//list + attempted or not
export async function GetSessionTests(req: Request, res: Response) {
    const { courseId, userId, page = 1 } = req.body;

    if (!courseId || !userId) {
        return res.status(400).json({
            success: false,
            error: "courseId or userId missing",
        });
    }

    const LIMIT = 20;
    const offset = (Number(page) - 1) * LIMIT;

    const cacheKey = `course:sessionTests:${courseId}:user:${userId}:page:${page}`;

    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            console.log(`cached homework`, cached)
            return res.json({
                success: true,
                homeworks: cached.homeworks,
                pagination: cached.pagination,
                source: "cache",
            });
        }

        const [homeworks, total] = await Promise.all([
            prisma.sessionTest.findMany({
                where: {
                    createdFor: {
                        bigCourseId: courseId,
                    },
                },
                select: {
                    id: true,
                    startTime: true,
                    endTime: true,
                    duration: true,
                    createdFor: {
                        select: {
                            id: true,
                            detail: true,
                            bigCourseId: true,
                            subject: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            }
                        },
                    },
                    sessionTestSubmission: {
                        where: {
                            endUsersId: userId,
                        },
                        select: {
                            id: true,
                        },
                        take: 1,
                    },
                },
                orderBy: {
                    startTime: "desc",
                },
                skip: offset,
                take: LIMIT,
            }),

            prisma.sessionTest.count({
                where: {
                    createdFor: {
                        bigCourseId: courseId,
                    },
                },
            }),
        ]);

        const response = homeworks.map((homework) => ({
            homeworkId: homework.id,
            courseId: homework.createdFor.bigCourseId,
            sessionTestForId: homework.createdFor.id,
            subject: homework.createdFor.subject.name,
            title: homework.createdFor.detail,
            startTime: homework.startTime,
            endTime: homework.endTime,
            duration: homework.duration,
            attempted: homework.sessionTestSubmission.length > 0,
            submissionId: homework.sessionTestSubmission[0]?.id ?? null,
        }));

        const pagination = {
            page: Number(page),
            limit: LIMIT,
            hasNext: offset + LIMIT < total,
        };

        const payload = {
            homeworks: response,
            pagination,
        };

        await setCache(cacheKey, payload, 600);

        return res.json({
            success: true,
            homeworks: response,
            pagination,
            source: "db",
        });
    } catch (error) {
        console.error("GetSessionTests error:", error);
        return res.status(500).json({ success: false, error });
    }
}

//questions (if not attempted)
export async function GetSessionTestQuestions(req: Request, res: Response) {
    const { sessionTestId, userId } = req.body;

    if (!sessionTestId || !userId) {
        return res.status(400).json({
            success: false,
            error: "sessionTestId or userId missing",
        });
    }

    try {
        const alreadyAttempted = await prisma.sessionTestSubmission.findFirst({
            where: {
                sessionTestId,
                endUsersId: userId,
            },
            select: { id: true },
        });

        if (alreadyAttempted) {
            return res.status(403).json({
                success: false,
                error: "Test already attempted",
            });
        }

        const cacheKey = `sessionTest:questions:${sessionTestId}`;

        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                questions: cached,
                source: "cache",
            });
        }

        const questions = await prisma.sessionTestQuestion.findMany({
            where: { sessionTestId },
            select: {
                id: true,
                question: true,
                option1: true,
                option2: true,
                option3: true,
                option4: true,
                correctResponse: true,
            },
            orderBy: { id: "asc" },
        });

        await setCache(cacheKey, questions, 300);

        return res.json({
            success: true,
            questions,
            source: "db",
        });
    } catch (error) {
        console.error("GetSessionTestQuestions error:", error);
        return res.status(500).json({ success: false, error });
    }
}


