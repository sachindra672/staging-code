import { prisma } from './misc'
import { Request, Response } from 'express'

export async function getStudentListSessionTestSubmission(req: Request, res: Response) {
    const { sessionTestId } = req.body;

    if (sessionTestId === undefined || sessionTestId === null) {
        return res.status(400).json({ success: false, error: 'Missing sessionTestId' });
    }

    const sessionTestIdNumber = Number(sessionTestId);

    if (isNaN(sessionTestIdNumber)) {
        return res.status(400).json({ success: false, error: 'Invalid sessionTestId format. Must be a number.' });
    }

    if (sessionTestIdNumber === 0) {
        return res.status(400).json({ success: false, error: 'Invalid sessionTestId. Cannot be 0.' });
    }

    try {
        const studentList = await prisma.sessionTestSubmission.findMany({
            where: { sessionTestId: sessionTestIdNumber },
            include: { user: true }
        });

        if (studentList.length === 0) {
            return res.status(404).json({ success: false, error: 'No submissions found for this session test' });
        }

        res.status(200).json({ success: true, studentList });
    } catch (error) {
        console.error('Error in getStudentListSessionTestSubmission:', error);

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

export async function createSessionTestSubmission(req: Request, res: Response): Promise<void> {
    const { sessionTestId, endUsersId, responses } = req.body;

    if (!sessionTestId || !endUsersId || !Array.isArray(responses)) {
        res.status(400).json({ success: false, error: 'Missing or invalid required fields' });
        return;
    }

    const sessionTestIdNumber = Number(sessionTestId);
    const endUsersIdNumber = Number(endUsersId);

    if (isNaN(sessionTestIdNumber) || sessionTestIdNumber <= 0) {
        res.status(400).json({ success: false, error: 'Invalid sessionTestId' });
        return;
    }

    if (isNaN(endUsersIdNumber) || endUsersIdNumber <= 0) {
        res.status(400).json({ success: false, error: 'Invalid endUsersId' });
        return;
    }

    if (responses.length === 0) {
        res.status(400).json({ success: false, error: 'At least one response is required' });
        return;
    }

    try {
        const newSubmission = await prisma.sessionTestSubmission.create({
            data: {
                sessionTestId: sessionTestIdNumber,
                endUsersId: endUsersIdNumber,
                sessionTestResponse: {
                    create: responses.map((response: any) => {
                        return {
                            forQuestion: { connect: { id: Number(response.sessionTestQuestionId) } },
                            response: response.response,
                            forTest: { connect: { id: sessionTestIdNumber } },
                            createdBy: { connect: { id: endUsersIdNumber } }
                        };
                    })
                }
            },
            include: {
                sessionTestResponse: true
            }
        });

        res.status(201).json({ success: true, newSubmission });
    } catch (error) {
        console.error('Error creating sessionTestSubmission with responses:', error);

        if (error instanceof Error) {
            if (error.message === 'Invalid response object') {
                res.status(400).json({ success: false, error: 'Invalid response object in the responses array' });
            } else if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({ success: false, error: 'Database error', message: error.message });
            } else {
                res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
            }
        } else {
            res.status(500).json({ success: false, error: 'An unexpected error occurred' });
        }
    }
}

export async function GetMySessionTestSubmission(req: Request, res: Response) {
    const { sessionId, endUsersId } = req.body;

    if (!sessionId || !endUsersId) {
        return res.status(400).json({ success: false, error: 'Missing sessionId or endUsersId' });
    }

    const sessionIdNumber = Number(sessionId);
    const endUsersIdNumber = Number(endUsersId);

    if (isNaN(sessionIdNumber) || sessionIdNumber <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid sessionId' });
    }

    if (isNaN(endUsersIdNumber) || endUsersIdNumber <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid endUsersId' });
    }

    try {
        const sessionTestIds = (await prisma.sessionTest.findMany({
            where: { sessionId: sessionIdNumber },
            select: { id: true },

        })).map(e => e.id);

        if (sessionTestIds.length === 0) {
            console.error('No session tests found for this session');
            return res.status(200).json({ success: true, submitted: false });
        }

        const [sessionTestQuestions, submission] = await Promise.all([
            prisma.sessionTestQuestion.findMany({
                where: {
                    sessionTestId: {
                        in: sessionTestIds
                    }
                },
            }),
            prisma.sessionTestSubmission.findMany({
                where: {
                    sessionTestId: {
                        in: sessionTestIds
                    },
                    endUsersId: endUsersIdNumber
                },
                include: { sessionTestResponse: true }
            })]);


        res.status(200).json({
            success: true,
            submission: submission,
            sessionTestQuestions: sessionTestQuestions,
            submitted: submission.length === 0 ? false : true,
        });
    } catch (error) {
        console.error('Error in GetMySessionTestSubmission:', error);

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

// export async function GetMyBigCourseSessionTestSubmissions(req: Request, res: Response) {
//     const { bigCourseId, endUsersId } = req.body;
//     console.log(req.body)
//     if (!bigCourseId || !endUsersId) {
//         return res.status(400).json({ success: false, error: 'Missing sessionId or endUsersId', bigCourseId, endUsersId });
//     }

//     const bigCourseIdNumber = Number(bigCourseId);
//     const endUsersIdNumber = Number(endUsersId);

//     if (isNaN(bigCourseIdNumber) || bigCourseIdNumber <= 0) {
//         return res.status(400).json({ success: false, error: 'Invalid sessionId' });
//     }

//     if (isNaN(endUsersIdNumber) || endUsersIdNumber <= 0) {
//         return res.status(400).json({ success: false, error: 'Invalid endUsersId' });
//     }

//     try {
//         const sessionTestIds = (await prisma.session.findMany({
//             where: { bigCourseId: bigCourseIdNumber },
//             include: { subject: true, SessionTest: { select: { id: true } } }
//         })).map(e => e.SessionTest.map(f => f.id)).flat();

//         if (!sessionTestIds || sessionTestIds.length === 0) {
//             console.error('No session tests found for this course');
//             return res.status(200).json({ success: false, submitted: false, message: 'No session tests found for this course' });
//         }

//         console.log('Session Test IDs:', sessionTestIds);
//         const submissions: (({ sessionTestResponse: { id: number; createdOn: Date; response: number; sessionTestQuestionId: number; sessionTestId: number; endUsersId: number; sessionTestSubmissionId: number; }[]; } & { id: number; sessionTestId: number; endUsersId: number; }) | null)[] = []

//         for (const sessionTestId of sessionTestIds) {
//             const submission = await prisma.sessionTestSubmission.findFirst({
//                 where: {
//                     sessionTestId: sessionTestId,
//                     endUsersId: endUsersIdNumber
//                 },
//                 include: { sessionTestResponse: true }
//             });
//             submissions.push(submission);
//         }

//         if (submissions.length === 0) {
//             return res.status(405).json({ success: false, submitted: false });
//         }
//         res.status(200).json({
//             success: true,
//             submission: submissions || null,
//             submitted: !!submissions
//         });
//     } catch (error) {
//         console.error('Error in GetMySessionTestSubmission:', error);

//         if (error instanceof Error) {
//             if (error.name === 'PrismaClientKnownRequestError') {
//                 res.status(400).json({ success: false, error: 'Database error', message: error.message });
//             } else {
//                 res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
//             }
//         } else {
//             res.status(500).json({ success: false, error: 'An unexpected error occurred' });
//         }
//     }
// }

export async function GetMyBigCourseSessionTestSubmissions(req: Request, res: Response) {
    const { bigCourseId, endUsersId } = req.body;
    if (!bigCourseId || !endUsersId) {
        return res.status(400).json({ success: false, error: "Missing bigCourseId or endUsersId" });
    }

    try {
        const sessions = await prisma.session.findMany({
            where: { bigCourseId: Number(bigCourseId) },
            include: {
                SessionTest: {
                    include: {
                        createdFor: true,
                        sessionTestQuestion: true,
                        sessionTestSubmission: {
                            where: { endUsersId: Number(endUsersId) },
                            include: {
                                sessionTestResponse: {
                                    include: { forQuestion: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!sessions.length) {
            return res.status(200).json({ success: false, message: "No session tests found" });
        }

        // Build structured result
        const result = sessions.flatMap((session) =>
            session.SessionTest.map((test) => {
                const submission = test.sessionTestSubmission[0]; // first (or latest) attempt
                if (!submission) {
                    return {
                        sessionTestId: test.id,
                        createdOn: test.createdOn,
                        submitted: false,
                        totalQuestions: test.sessionTestQuestion.length
                    };
                }

                // calculate score
                let score = 0;
                submission.sessionTestResponse.forEach((resp) => {
                    if (resp.response === resp.forQuestion.correctResponse) {
                        score++;
                    }
                });

                return {
                    sessionTestId: test.id,
                    createdOn: test.createdOn,
                    submitted: true,
                    submissionCreatedOn: submission.createdOn,
                    score,
                    totalQuestions: test.sessionTestQuestion.length,
                    questions: test.sessionTestQuestion.map((q) => ({
                        id: q.id,
                        question: q.question,
                        option1: q.option1,
                        option2: q.option2,
                        option3: q.option3,
                        option4: q.option4,
                        correctResponse: q.correctResponse,
                        response:
                            submission.sessionTestResponse.find((r) => r.sessionTestQuestionId === q.id)?.response ??
                            null
                    }))
                };
            })
        );

        res.status(200).json({ success: true, submissions: result });
    } catch (error) {
        console.error("Error in GetMyBigCourseSessionTestSubmissions:", error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Unexpected error"
        });
    }
}

export async function GetMyBigCourseSessionTestSubmissionsByDate(req: Request, res: Response) {
    const { bigCourseId, endUsersId, startDate, endDate } = req.body;

    if (!bigCourseId || !endUsersId || !startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    const bigCourseIdNumber = Number(bigCourseId);
    const endUsersIdNumber = Number(endUsersId);

    if (isNaN(bigCourseIdNumber) || bigCourseIdNumber <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid bigCourseId' });
    }
    if (isNaN(endUsersIdNumber) || endUsersIdNumber <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid endUsersId' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid date format' });
    }

    try {
        // 1. Get all session tests for the course
        const sessions = await prisma.session.findMany({
            where: { bigCourseId: bigCourseIdNumber },
            include: {
                SessionTest: {
                    select: { id: true, createdOn: true }
                }
            }
        });

        // Flatten all tests into a list with their date
        const allTests = sessions
            .flatMap(s => s.SessionTest)
            .filter(t => t.createdOn >= start && t.createdOn <= end);

        if (!allTests.length) {
            return res.status(200).json({
                success: false,
                message: 'No homework/tests found in this date range',
                data: []
            });
        }

        const testIds = allTests.map(t => t.id);

        // 2. Get student's submissions in that range
        const submissions = await prisma.sessionTestSubmission.findMany({
            where: {
                sessionTestId: { in: testIds },
                endUsersId: endUsersIdNumber,
                createdOn: {
                    gte: start,
                    lte: end
                }
            },
            select: { sessionTestId: true }
        });

        const submittedTestIds = new Set(submissions.map(s => s.sessionTestId));

        // 3. Build a list of all dates with yes/no
        const results = allTests.map(test => {
            const date = test.createdOn.toISOString().split('T')[0];
            return {
                date,
                done: submittedTestIds.has(test.id) ? 'yes' : 'no'
            };
        });

        // If multiple tests on same date, mark "yes" if any were done
        const finalResults = Object.values(
            results.reduce((acc, { date, done }) => {
                if (!acc[date]) acc[date] = { date, done };
                else if (done === 'yes') acc[date].done = 'yes';
                return acc;
            }, {} as Record<string, { date: string; done: string }>)
        );

        res.status(200).json({
            success: true,
            data: finalResults
        });

    } catch (error) {
        console.error('Error in GetMyBigCourseSessionTestSubmissionsByDate:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}


