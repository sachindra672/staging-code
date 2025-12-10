
import { prisma } from './misc'
import { Request, Response } from 'express'


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
