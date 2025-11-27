import { prisma } from './misc'
import { Request, Response } from 'express'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export async function createqtest(req: Request, res: Response) {
    try {
        const {
            title,
            Duration,
            startDate,
            endDate,
            bigCourseId,
            subjectId,
            mentorId,
            qtestQuestions,
            sessionId
        } = req.body;

        // Safety and null checks
        if (!title || typeof title !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing title' });
        }

        if (typeof Duration !== 'number' || Duration <= 0) {
            return res.status(400).json({ error: 'Invalid or missing Duration' });
        }

        if (!startDate || isNaN(Date.parse(startDate))) {
            return res.status(400).json({ error: 'Invalid or missing startDate' });
        }

        if (!endDate || isNaN(Date.parse(endDate))) {
            return res.status(400).json({ error: 'Invalid or missing endDate' });
        }

        if (typeof bigCourseId !== 'number' || bigCourseId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing bigCourseId' });
        }

        if (typeof subjectId !== 'number' || subjectId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing subjectId' });
        }

        if (typeof mentorId !== 'number' || mentorId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing mentorId' });
        }

        if (!Array.isArray(qtestQuestions) || qtestQuestions.length === 0) {
            return res.status(400).json({ error: 'Invalid or missing qtestQuestions' });
        }

        for (const question of qtestQuestions) {
            if (
                !question.question ||
                typeof question.question !== 'string' ||
                !['multipleChoice', 'trueFalse'].includes(question.type) ||
                typeof question.option1 !== 'string' ||
                typeof question.option2 !== 'string' ||
                (question.option3 && typeof question.option3 !== 'string') ||
                (question.option4 && typeof question.option4 !== 'string') ||
                typeof question.correctResponse !== 'number' ||
                question.correctResponse <= 0
            ) {
                return res.status(400).json({ error: 'Invalid question format in qtestQuestions' });
            }
        }

        const newqtest = await prisma.qtest.create({
            data: {
                title,
                Duration,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                bigCourseId,
                subjectId,
                mentorId,
                sessionId,
                qtestQuestions: {
                    create: qtestQuestions.map(function (question) {
                        return {
                            question: question.question,
                            type: question.type,
                            option1: question.option1,
                            option2: question.option2,
                            option3: question.option3,
                            option4: question.option4,
                            correctResponse: question.correctResponse,
                        };
                    })
                }
            },
            include: {
                qtestQuestions: true
            }
        });

        res.status(201).json({ success: true, newqtest });
    } catch (error) {
        console.error('Error creating qtest with questions:', error);
        res.status(500).json({ succss: false, error: 'Internal server error' });
    }
}

export async function Getqtests(req: Request, res: Response) {
    const { sessionId } = req.body;

    if (!sessionId || sessionId == 0) {
        res.status(400).json({ success: false, error: 'bigCourseId is required' });
        return;
    }

    try {
        const qtests = await prisma.qtest.findMany({
            where: { sessionId },
            include: { qtestQuestions: true }
        });

        res.status(200).json({ success: true, qtests });
    } catch (error) {
        console.error('Error fetching qtests with questions:', error);

        if (error instanceof PrismaClientKnownRequestError) {
            res.status(500).json({ success: false, error: error.message });
        } else {
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}

export async function createqtestSubmission(req: Request, res: Response) {
    try {
        const { qtestId, endUsersId, responses } = req.body;

        if (typeof qtestId !== 'number' || qtestId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing qtestId' });
        }

        if (typeof endUsersId !== 'number' || endUsersId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing endUsersId' });
        }

        if (!Array.isArray(responses) || responses.length === 0) {
            return res.status(400).json({ error: 'Invalid or missing responses' });
        }

        for (const response of responses) {
            if (typeof response.response !== 'number' ||
                typeof response.qtestQuestionsId !== 'number' ||
                response.response <= 0 ||
                response.qtestQuestionsId <= 0) {
                return res.status(400).json({ error: 'Invalid response format in responses' });
            }
        }

        const newSubmission = await prisma.qtestSubmission.create({
            data: {
                qtestId: qtestId,
                endUsersId: endUsersId,
            },
        });

        const responsePromises = responses.map((response) =>
            prisma.qTestResponse.create({
                data: {
                    response: response.response,
                    endUsersId: endUsersId,
                    qtestQuestionsId: response.qtestQuestionsId,
                    qtestId: qtestId,
                    qtestSubmissionId: newSubmission.id,
                },
            })
        );

        await Promise.all(responsePromises);

        res.status(201).json({ success: true, newSubmission });
    } catch (error) {
        console.error('Error creating qtest submission with responses:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

export async function GetMyqtestSubmission(req: Request, res: Response) {
    const { endUsersId, qtestId } = req.body;

    if (!endUsersId || !qtestId || endUsersId == 0 || qtestId == 0) {
        res.status(400).json({ success: false, error: 'endUsersId and qtestId are required' });
        return;
    }

    try {
        const mySubmissions = await prisma.qtestSubmission.findMany({
            where: { endUsersId, qtestId },
            include: {
                qtest: {
                    include: { qtestQuestions: true },
                },
                qTestResponse: true
            }
        });

        res.json({ success: true, mySubmissions, isSubmitted: !!mySubmissions.length });
    } catch (error) {
        console.error('Error fetching qtest submissions:', error);

        if (error instanceof PrismaClientKnownRequestError) {
            res.status(500).json({ success: false, error: error.message });
        } else {
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}

export async function GetAllqtestSubmissionsByCourse(req: Request, res: Response) {
    const { bigCourseId } = req.body

    try {
        const qtestIds = (await prisma.qtest.findMany({ where: { bigCourseId } })).map(e => e.id)
        const qtestSubmissions = await prisma.qtestSubmission.findMany({ where: { qtestId: { in: qtestIds } } })
        res.json({ success: true, qtestSubmissions });

    } catch (error) {
        console.error('Error fetching qtest submissions:', error);

        if (error instanceof PrismaClientKnownRequestError) {
            res.status(500).json({ success: false, error: error.message });
        } else {
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}

export async function GetMyBigCourseqtestSubmission(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body;

    if (!endUsersId || !bigCourseId || endUsersId == 0 || bigCourseId == 0) {
        res.status(400).json({ success: false, error: 'endUsersId and qtestId are required', bigCourseId, endUsersId });
        return;
    }

    try {
        const qtestIds = (await prisma.qtest.findMany({ where: { bigCourseId }, select: { id: true } })).map(e => e.id)
        const mySubmissions = await prisma.qtestSubmission.findMany({
            where: {
                endUsersId: endUsersId,
                qtestId: {
                    in: qtestIds
                }
            },
            include: {
                qtest: {
                    include: { qtestQuestions: true },
                },
                qTestResponse: true
            }
        });

        res.json({ success: true, mySubmissions, isSubmitted: !!mySubmissions.length });
    } catch (error) {
        console.error('Error fetching qtest submissions:', error);

        if (error instanceof PrismaClientKnownRequestError) {
            res.status(500).json({ success: false, error: error.message });
        } else {
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}