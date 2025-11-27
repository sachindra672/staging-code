import { prisma } from './misc'
import { Request, Response } from 'express'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Storage } from "@google-cloud/storage";
import { nanoid } from "nanoid";

const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GCP_KEYFILE_PATH,
});

const bucket = storage.bucket(process.env.GCP_BUCKET!);

export const generateCtestAttachmentUploadUrl = async (req: Request, res: Response) => {
    try {
        const { ctestId, questionId, endUsersId } = req.query;

        if (!ctestId || !questionId || !endUsersId) {
            return res.status(400).json({
                error: "Missing ctestId, questionId, or endUsersId"
            });
        }

        const timestamp = Date.now();

        const fileName = `ctest-submissions/${endUsersId}/${ctestId}/${questionId}/${nanoid()}-${timestamp}`;

        const file = bucket.file(fileName);

        const [url] = await file.getSignedUrl({
            version: "v4",
            action: "write",
            expires: Date.now() + 10 * 60 * 1000,
            contentType: "*/*", // accept ANY type
        });

        res.json({
            uploadUrl: url,
            filePath: `https://storage.googleapis.com/${process.env.GCP_BUCKET}/${fileName}`,
        });

    } catch (err) {
        console.error("Error generating CTest attachment upload URL:", err);
        res.status(500).json({ error: "Failed to generate upload URL" });
    }
};

// all the without 2 will removed later
export async function createCtest(req: Request, res: Response) {
    try {
        const {
            title,
            startDate,
            endDate,
            bigCourseId,
            subjectId,
            mentorId,
            ctestQuestions
        } = req.body;

        // Safety and null checks
        if (!title || typeof title !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing title' });
        }

        if (!startDate || isNaN(Date.parse(startDate))) {
            return res.status(400).json({ error: 'Invalid or missing startDate' });
        }

        if (!endDate || isNaN(Date.parse(endDate))) {
            return res.status(400).json({ error: 'Invalid or missing endDate' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start >= end) {
            return res.status(400).json({ error: 'startDate must be before endDate' });
        }

        const durationMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60)); // Duration in minutes

        if (typeof bigCourseId !== 'number' || bigCourseId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing bigCourseId' });
        }

        if (typeof subjectId !== 'number' || subjectId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing subjectId' });
        }

        if (typeof mentorId !== 'number' || mentorId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing mentorId' });
        }

        if (!Array.isArray(ctestQuestions) || ctestQuestions.length === 0) {
            return res.status(400).json({ error: 'Invalid or missing ctestQuestions' });
        }

        for (const question of ctestQuestions) {
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
                return res.status(400).json({ error: 'Invalid question format in ctestQuestions' });
            }
        }

        const newCtest = await prisma.ctest.create({
            data: {
                title,
                Duration: durationMinutes,
                startDate: start,
                endDate: end,
                bigCourseId,
                subjectId,
                mentorId,
                ctestQuestions: {
                    create: ctestQuestions.map((question) => ({
                        question: question.question,
                        type: question.type,
                        option1: question.option1,
                        option2: question.option2,
                        option3: question.option3,
                        option4: question.option4,
                        correctResponse: question.correctResponse,
                    })),
                },
            },
            include: {
                ctestQuestions: true,
            },
        });

        res.status(201).json({ success: true, newCtest });
    } catch (error) {
        console.error('Error creating ctest with questions:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

export async function createCtest2(req: Request, res: Response) {
    try {
        const {
            title,
            startDate,
            endDate,
            bigCourseId,
            subjectId,
            mentorId,
            ctestQuestions
        } = req.body;

        if (!title || typeof title !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing title' });
        }

        if (!startDate || isNaN(Date.parse(startDate))) {
            return res.status(400).json({ error: 'Invalid or missing startDate' });
        }

        if (!endDate || isNaN(Date.parse(endDate))) {
            return res.status(400).json({ error: 'Invalid or missing endDate' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start >= end) {
            return res.status(400).json({ error: 'startDate must be before endDate' });
        }

        const durationMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

        if (!bigCourseId || !subjectId || !mentorId) {
            return res.status(400).json({ error: 'Missing required IDs' });
        }

        if (!Array.isArray(ctestQuestions) || ctestQuestions.length === 0) {
            return res.status(400).json({ error: 'Invalid or missing ctestQuestions' });
        }

        for (const q of ctestQuestions) {
            if (!q.question || typeof q.question !== 'string') {
                return res.status(400).json({ error: 'Invalid question text' });
            }

            if (!['multipleChoice', 'trueFalse', 'subjective'].includes(q.type)) {
                return res.status(400).json({ error: 'Invalid question type' });
            }

            if (q.type !== 'subjective') {
                if (!q.option1 || !q.option2) {
                    return res.status(400).json({ error: 'MCQ requires minimum two options' });
                }
                if (!q.correctResponse) {
                    return res.status(400).json({ error: 'MCQ requires correctResponse' });
                }
            }

            if (q.type === 'subjective') {
                // Subjective fields are optional but supported
                // Correct response is NOT required
            }
        }

        const newCtest = await prisma.ctest.create({
            data: {
                title,
                Duration: durationMinutes,
                startDate: start,
                endDate: end,
                bigCourseId,
                subjectId,
                mentorId,
                ctestQuestions: {
                    create: ctestQuestions.map((q) => ({
                        question: q.question,
                        type: q.type,
                        option1: q.option1 || null,
                        option2: q.option2 || null,
                        option3: q.option3 || null,
                        option4: q.option4 || null,
                        correctResponse: q.type === 'subjective' ? 0 : q.correctResponse,

                        // subjective support
                        isSubjective: q.type === 'subjective',
                        maxWords: q.maxWords || null,
                        allowAttachments: q.allowAttachments ?? false,
                    })),
                },
            },
            include: { ctestQuestions: true },
        });

        res.status(201).json({ success: true, newCtest });

    } catch (error) {
        console.error('Error creating ctest:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}


export async function editCtest(req: Request, res: Response) {
    try {
        const {
            ctestId,
            title,
            startDate,
            endDate,
            bigCourseId,
            subjectId,
            mentorId,
            ctestQuestions,
        } = req.body;

        // Basic validation
        if (!ctestId || typeof ctestId !== 'number') {
            return res.status(400).json({ error: 'Invalid or missing ctestId' });
        }

        if (!title || typeof title !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing title' });
        }

        if (!startDate || isNaN(Date.parse(startDate))) {
            return res.status(400).json({ error: 'Invalid or missing startDate' });
        }

        if (!endDate || isNaN(Date.parse(endDate))) {
            return res.status(400).json({ error: 'Invalid or missing endDate' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start >= end) {
            return res.status(400).json({ error: 'startDate must be before endDate' });
        }

        const durationMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

        if (typeof bigCourseId !== 'number' || bigCourseId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing bigCourseId' });
        }

        if (typeof subjectId !== 'number' || subjectId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing subjectId' });
        }

        if (typeof mentorId !== 'number' || mentorId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing mentorId' });
        }

        if (!Array.isArray(ctestQuestions)) {
            return res.status(400).json({ error: 'Invalid or missing ctestQuestions' });
        }

        for (const question of ctestQuestions) {
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
                return res.status(400).json({ error: 'Invalid question format in ctestQuestions' });
            }
        }

        // Delete old questions
        await prisma.ctestQuestions.deleteMany({ where: { ctestId } });

        // Update ctest and recreate questions
        const updatedCtest = await prisma.ctest.update({
            where: { id: ctestId },
            data: {
                title,
                startDate: start,
                endDate: end,
                Duration: durationMinutes,
                bigCourseId,
                subjectId,
                mentorId,
                modifiedOn: new Date(),
                ctestQuestions: {
                    create: ctestQuestions.map((question) => ({
                        question: question.question,
                        type: question.type,
                        option1: question.option1,
                        option2: question.option2,
                        option3: question.option3,
                        option4: question.option4,
                        correctResponse: question.correctResponse,
                        createdOn: new Date(),
                        modifiedOn: new Date(),
                    })),
                },
            },
            include: {
                ctestQuestions: true,
            },
        });

        return res.status(200).json({ success: true, updatedCtest });
    } catch (error) {
        console.error('Error updating ctest:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

export async function editCtest2(req: Request, res: Response) {
    try {
        const {
            ctestId,
            title,
            startDate,
            endDate,
            bigCourseId,
            subjectId,
            mentorId,
            ctestQuestions,
        } = req.body;

        if (!ctestId) {
            return res.status(400).json({ error: 'Missing ctestId' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const durationMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

        if (!Array.isArray(ctestQuestions)) {
            return res.status(400).json({ error: 'Invalid ctestQuestions' });
        }

        // delete old questions
        await prisma.ctestQuestions.deleteMany({ where: { ctestId } });

        const updated = await prisma.ctest.update({
            where: { id: ctestId },
            data: {
                title,
                startDate: start,
                endDate: end,
                Duration: durationMinutes,
                bigCourseId,
                subjectId,
                mentorId,
                modifiedOn: new Date(),
                ctestQuestions: {
                    create: ctestQuestions.map((q) => ({
                        question: q.question,
                        type: q.type,
                        option1: q.option1 || null,
                        option2: q.option2 || null,
                        option3: q.option3 || null,
                        option4: q.option4 || null,
                        correctResponse: q.type === 'subjective' ? 0 : q.correctResponse,

                        isSubjective: q.type === 'subjective',
                        maxWords: q.maxWords || null,
                        allowAttachments: q.allowAttachments ?? false,
                    })),
                },
            },
            include: { ctestQuestions: true },
        });

        res.json({ success: true, updated });

    } catch (error) {
        console.error('Error editing ctest:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}



export async function GetCtests(req: Request, res: Response) {
    const { bigCourseId } = req.body;

    if (!bigCourseId) {
        res.status(400).json({ success: false, error: 'bigCourseId is required' });
        return;
    }

    try {
        const ctests = await prisma.ctest.findMany({
            where: { bigCourseId },
            include: { ctestQuestions: true }
        });

        res.status(200).json({ success: true, ctests });
    } catch (error) {
        console.error('Error fetching ctests with questions:', error);

        if (error instanceof PrismaClientKnownRequestError) {
            res.status(500).json({ success: false, error: error.message });
        } else {
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}

export async function createCtestSubmission(req: Request, res: Response) {
    try {
        const { ctestId, endUsersId, responses } = req.body;

        if (typeof ctestId !== 'number' || ctestId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing ctestId' });
        }

        if (typeof endUsersId !== 'number' || endUsersId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing endUsersId' });
        }

        if (!Array.isArray(responses) || responses.length === 0) {
            return res.status(400).json({ error: 'Invalid or missing responses' });
        }

        for (const response of responses) {
            if (typeof response.response !== 'number' ||
                typeof response.ctestQuestionsId !== 'number' ||
                response.response <= 0 ||
                response.ctestQuestionsId <= 0) {
                return res.status(400).json({ error: 'Invalid response format in responses' });
            }
        }

        const newSubmission = await prisma.ctestSubmission.create({
            data: {
                ctestId: ctestId,
                endUsersId: endUsersId,
            },
        });

        const responsePromises = responses.map((response) =>
            prisma.cTestResponse.create({
                data: {
                    response: response.response,
                    endUsersId: endUsersId,
                    ctestQuestionsId: response.ctestQuestionsId,
                    ctestId: ctestId,
                    ctestSubmissionId: newSubmission.id,
                },
            })
        );

        await Promise.all(responsePromises);

        res.status(201).json({ success: true, newSubmission });
    } catch (error) {
        console.error('Error creating ctest submission with responses:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

export async function createCtestSubmission2(req: Request, res: Response) {
    try {
        const { ctestId, endUsersId, responses } = req.body;

        if (!ctestId || !endUsersId) {
            return res.status(400).json({ error: 'Missing ids' });
        }

        const submission = await prisma.ctestSubmission.create({
            data: { ctestId, endUsersId },
        });

        const promises = responses.map((r) =>
            prisma.cTestResponse.create({
                data: {
                    response: r.response ?? null,
                    subjectiveAnswer: r.subjectiveAnswer ?? null,
                    attachments: r.attachments ?? [],
                    endUsersId,
                    ctestQuestionsId: r.ctestQuestionsId,
                    ctestId,
                    ctestSubmissionId: submission.id,
                },
            })
        );

        await Promise.all(promises);

        res.status(201).json({ success: true, submission });

    } catch (error) {
        console.error('Error creating submission:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

export async function GetMyCtestSubmission(req: Request, res: Response) {
    const { endUsersId, ctestId } = req.body;

    if (!endUsersId || !ctestId || endUsersId == 0 || ctestId == 0) {
        res.status(400).json({ success: false, error: 'endUsersId and ctestId are required' });
        return;
    }

    try {
        const mySubmissions = await prisma.ctestSubmission.findMany({
            where: { endUsersId, ctestId },
            include: {
                ctest: {
                    include: { ctestQuestions: true },
                },
                cTestResponse: true
            }
        });

        res.json({ success: true, mySubmissions, isSubmitted: !!mySubmissions.length });
    } catch (error) {
        console.error('Error fetching ctest submissions:', error);

        if (error instanceof PrismaClientKnownRequestError) {
            res.status(500).json({ success: false, error: error.message });
        } else {
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}

export async function GetAllCtestSubmissionsByCourse(req: Request, res: Response) {
    const { bigCourseId } = req.body

    try {
        const ctestIds = (await prisma.ctest.findMany({ where: { bigCourseId } })).map(e => e.id)
        const ctestSubmissions = await prisma.ctestSubmission.findMany({ where: { ctestId: { in: ctestIds } } })
        res.json({ success: true, ctestSubmissions });

    } catch (error) {
        console.error('Error fetching ctest submissions:', error);

        if (error instanceof PrismaClientKnownRequestError) {
            res.status(500).json({ success: false, error: error.message });
        } else {
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}

export async function GetMyBigCourseCtestSubmission(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body;

    if (!endUsersId || !bigCourseId || endUsersId == 0 || bigCourseId == 0) {
        res.status(400).json({ success: false, error: 'endUsersId and ctestId are required', bigCourseId, endUsersId });
        return;
    }

    try {
        const ctestIds = (await prisma.ctest.findMany({ where: { bigCourseId }, select: { id: true } })).map(e => e.id)
        const mySubmissions = await prisma.ctestSubmission.findMany({
            where: {
                endUsersId: endUsersId,
                ctestId: {
                    in: ctestIds
                }
            },
            include: {
                ctest: {
                    include: { ctestQuestions: true },
                },
                cTestResponse: true
            }
        });

        res.json({ success: true, mySubmissions, isSubmitted: !!mySubmissions.length });
    } catch (error) {
        console.error('Error fetching ctest submissions:', error);

        if (error instanceof PrismaClientKnownRequestError) {
            res.status(500).json({ success: false, error: error.message });
        } else {
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}

export const deleteCTest = async (req: Request, res: Response) => {
    const { id } = req.body;

    if (!id || typeof id !== 'number') {
        return res.status(400).json({ error: 'Invalid or missing ctest ID' });
    }

    try {
        const existing = await prisma.ctest.findUnique({ where: { id } });

        if (!existing) {
            return res.status(404).json({ error: 'CTest not found' });
        }

        await prisma.cTestResponse.deleteMany({ where: { ctestId: id } });
        await prisma.ctestSubmission.deleteMany({ where: { ctestId: id } });
        await prisma.ctestQuestions.deleteMany({ where: { ctestId: id } });

        await prisma.ctest.delete({ where: { id } });

        return res.status(200).json({ message: 'CTest and related data deleted successfully' });
    } catch (error) {
        console.error('Error deleting ctest:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};