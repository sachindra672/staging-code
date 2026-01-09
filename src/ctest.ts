import { prisma } from './misc'
import { Request, Response } from 'express'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Storage } from "@google-cloud/storage";
import { nanoid } from "nanoid";
import { grantTaskReward } from './sisyacoin/taskRewardController'
import { getSystemWallet } from './config/sisyacoinHelperFunctions'
import { Decimal } from "@prisma/client/runtime/library";
import { CTestMode, CTestSubmissionStatus } from '@prisma/client';
import { getCache, invalidateCache, setCache } from './utils/cacheUtils';

const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GCP_KEYFILE_PATH,
});

const bucket = storage.bucket(process.env.GCP_BUCKET!);

type ImageQuestionInput = {
    questionId?: string
    prompt?: string
    instructions?: string
    questionImages?: string[]
    maxMarks: number
    maxAnswerImages?: number
    sortOrder?: number
}

type McqQuestionInput = {
    question: string
    type: 'multipleChoice' | 'trueFalse' | 'subjective'
    option1?: string
    option2?: string
    option3?: string
    option4?: string
    correctResponse?: number
    maxWords?: number
    allowAttachments?: boolean
}

type CreateCtestPayload = {
    title: string
    startDate: string
    endDate: string
    bigCourseId: number
    subjectId: number
    mentorId: number
    ctestQuestions?: McqQuestionInput[]
    imageQuestions?: ImageQuestionInput[]
    mode?: CTestMode
    totalMarks?: number
}

type UpdateCtestPayload = CreateCtestPayload & {
    ctestId: number
}

type SubmissionResponseInput = {
    ctestQuestionsId: number
    response: number
}

type CtestSubmissionPayload = {
    ctestId: number
    endUsersId: number
    responses: SubmissionResponseInput[]
}

type ImageAnswerInput = {
    questionId: number
    answerImages: string[]
    notes?: string
}

type ImageCtestSubmissionPayload = {
    ctestId: number
    endUsersId: number
    answers: ImageAnswerInput[]
}

const normalizeCTestMode = (value: unknown): CTestMode | null => {
    if (value === undefined || value === null) {
        return CTestMode.MCQ;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.toUpperCase() as CTestMode;
    return Object.values(CTestMode).includes(normalized) ? normalized : null;
}

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

const deriveImageTotalMarks = (questions: ImageQuestionInput[]): number => {
    return questions.reduce((sum, q) => sum + (typeof q.maxMarks === 'number' ? q.maxMarks : 0), 0);
}

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

export const generateCtestAnswerUploadUrl = async (req: Request, res: Response) => {
    try {
        const { ctestId, questionId, endUsersId } = req.query;

        if (!ctestId || !questionId || !endUsersId) {
            return res.status(400).json({
                error: "Missing ctestId, questionId, or endUsersId"
            });
        }

        const timestamp = Date.now();
        const fileName = `ctest-image-answers/${endUsersId}/${ctestId}/${questionId}/${nanoid()}-${timestamp}`;

        const file = bucket.file(fileName);

        const [url] = await file.getSignedUrl({
            version: "v4",
            action: "write",
            expires: Date.now() + 10 * 60 * 1000,
            contentType: "image/*",
        });

        res.json({
            uploadUrl: url,
            filePath: `https://storage.googleapis.com/${process.env.GCP_BUCKET}/${fileName}`,
        });

    } catch (err) {
        console.error("Error generating CTest answer upload URL:", err);
        res.status(500).json({ error: "Failed to generate answer upload URL" });
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
            ctestQuestions,
            imageQuestions,
            mode,
            totalMarks,
        } = req.body as CreateCtestPayload;

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

        const resolvedMode = normalizeCTestMode(mode);
        if (!resolvedMode) {
            return res.status(400).json({ error: 'Invalid ctest mode' });
        }

        const isImageMode = resolvedMode === CTestMode.IMAGE;
        let imageQuestionList: ImageQuestionInput[] = [];
        let mcqQuestionList: McqQuestionInput[] = [];

        if (isImageMode) {
            if (!Array.isArray(imageQuestions) || imageQuestions.length === 0) {
                return res.status(400).json({ error: 'Image mode requires imageQuestions array' });
            }

            for (const [index, question] of imageQuestions.entries()) {
                if (!question || typeof question !== 'object') {
                    return res.status(400).json({ error: `Invalid image question payload at index ${index}` });
                }

                if (typeof question.maxMarks !== 'number' || question.maxMarks <= 0) {
                    return res.status(400).json({ error: `maxMarks must be > 0 for image question at index ${index}` });
                }

                if (question.questionImages && !isStringArray(question.questionImages)) {
                    return res.status(400).json({ error: `questionImages must be an array of strings at index ${index}` });
                }

                if (question.maxAnswerImages !== undefined && (typeof question.maxAnswerImages !== 'number' || question.maxAnswerImages <= 0)) {
                    return res.status(400).json({ error: `maxAnswerImages must be a positive number at index ${index}` });
                }

                if (question.questionId !== undefined && typeof question.questionId !== 'string') {
                    return res.status(400).json({ error: `questionId must be a string at index ${index}` });
                }
            }

            imageQuestionList = imageQuestions as ImageQuestionInput[];
        } else {
            if (!Array.isArray(ctestQuestions) || ctestQuestions.length === 0) {
                return res.status(400).json({ error: 'MCQ mode requires ctestQuestions array' });
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
            }

            mcqQuestionList = ctestQuestions as McqQuestionInput[];
        }

        const derivedTotalMarks = typeof totalMarks === 'number' && totalMarks > 0
            ? totalMarks
            : isImageMode
                ? deriveImageTotalMarks(imageQuestionList)
                : mcqQuestionList.length;

        const createData: any = {
            title,
            Duration: durationMinutes,
            startDate: start,
            endDate: end,
            bigCourseId,
            subjectId,
            mentorId,
            mode: resolvedMode,
            totalMarks: derivedTotalMarks || null,
        };

        if (isImageMode) {
            createData.imageQuestions = {
                create: imageQuestionList.map((question: ImageQuestionInput, index: number) => ({
                    prompt: question.prompt ?? null,
                    instructions: question.instructions ?? null,
                    questionImages: question.questionImages ?? [],
                    maxMarks: question.maxMarks,
                    maxAnswerImages: question.maxAnswerImages ?? 5,
                    sortOrder: question.sortOrder ?? index,
                })),
            };
        } else {
            createData.ctestQuestions = {
                create: mcqQuestionList.map((q: McqQuestionInput) => ({
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
            };
        }

        const newCtest = await prisma.ctest.create({
            data: createData,
            include: { ctestQuestions: true, imageQuestions: true },
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
            imageQuestions,
            mode,
            totalMarks,
        } = req.body as UpdateCtestPayload;

        if (!ctestId) {
            return res.status(400).json({ error: 'Missing ctestId' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const durationMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

        const resolvedMode = normalizeCTestMode(mode);
        if (!resolvedMode) {
            return res.status(400).json({ error: 'Invalid ctest mode' });
        }

        const isImageMode = resolvedMode === CTestMode.IMAGE;
        let imageQuestionList: ImageQuestionInput[] = [];
        let mcqQuestionList: McqQuestionInput[] = [];

        if (isImageMode) {
            if (!Array.isArray(imageQuestions) || imageQuestions.length === 0) {
                return res.status(400).json({ error: 'Image mode requires imageQuestions array' });
            }

            for (const [index, question] of imageQuestions.entries()) {
                if (!question || typeof question !== 'object') {
                    return res.status(400).json({ error: `Invalid image question payload at index ${index}` });
                }

                if (typeof question.maxMarks !== 'number' || question.maxMarks <= 0) {
                    return res.status(400).json({ error: `maxMarks must be > 0 for image question at index ${index}` });
                }

                if (question.questionImages && !isStringArray(question.questionImages)) {
                    return res.status(400).json({ error: `questionImages must be an array of strings at index ${index}` });
                }

                if (question.maxAnswerImages !== undefined && (typeof question.maxAnswerImages !== 'number' || question.maxAnswerImages <= 0)) {
                    return res.status(400).json({ error: `maxAnswerImages must be a positive number at index ${index}` });
                }

                if (question.questionId !== undefined && typeof question.questionId !== 'string') {
                    return res.status(400).json({ error: `questionId must be a string at index ${index}` });
                }
            }

            imageQuestionList = imageQuestions as ImageQuestionInput[];
        } else {
            if (!Array.isArray(ctestQuestions)) {
                return res.status(400).json({ error: 'Invalid ctestQuestions' });
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
            }

            mcqQuestionList = ctestQuestions as McqQuestionInput[];
        }

        // delete old questions of both types
        await prisma.ctestQuestions.deleteMany({ where: { ctestId } });
        await prisma.ctestImageQuestion.deleteMany({ where: { ctestId } });

        const derivedTotalMarks = typeof totalMarks === 'number' && totalMarks > 0
            ? totalMarks
            : isImageMode
                ? deriveImageTotalMarks(imageQuestionList)
                : mcqQuestionList.length;

        const updateData: any = {
            title,
            startDate: start,
            endDate: end,
            Duration: durationMinutes,
            bigCourseId,
            subjectId,
            mentorId,
            modifiedOn: new Date(),
            mode: resolvedMode,
            totalMarks: derivedTotalMarks || null,
        };

        if (isImageMode) {
            updateData.imageQuestions = {
                create: imageQuestionList.map((question: ImageQuestionInput, index: number) => ({
                    prompt: question.prompt ?? null,
                    instructions: question.instructions ?? null,
                    questionImages: question.questionImages ?? [],
                    maxMarks: question.maxMarks,
                    maxAnswerImages: question.maxAnswerImages ?? 5,
                    sortOrder: question.sortOrder ?? index,
                })),
            };
        } else {
            updateData.ctestQuestions = {
                create: mcqQuestionList.map((q: McqQuestionInput) => ({
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
            };
        }

        const updated = await prisma.ctest.update({
            where: { id: ctestId },
            data: updateData,
            include: { ctestQuestions: true, imageQuestions: true },
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
            include: { ctestQuestions: true, imageQuestions: true }
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
        const { ctestId, endUsersId, responses } = req.body as CtestSubmissionPayload;

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

        const ctest = await prisma.ctest.findUnique({
            where: { id: ctestId },
            select: { mode: true },
        });

        if (!ctest) {
            return res.status(404).json({ error: 'CTest not found' });
        }

        if (ctest.mode === CTestMode.IMAGE) {
            return res.status(400).json({ error: 'Use createImageCtestSubmission for image-based tests' });
        }

        const newSubmission = await prisma.ctestSubmission.create({
            data: {
                ctestId: ctestId,
                endUsersId: endUsersId,
            },
        });

        const responsePromises = responses.map((response: SubmissionResponseInput) =>
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

export async function createImageCtestSubmission(req: Request, res: Response) {
    try {
        const { ctestId, endUsersId, answers } = req.body as ImageCtestSubmissionPayload;

        if (typeof ctestId !== 'number' || ctestId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing ctestId' });
        }

        if (typeof endUsersId !== 'number' || endUsersId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing endUsersId' });
        }

        if (!Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({ error: 'answers array is required for image submissions' });
        }

        const ctest = await prisma.ctest.findUnique({
            where: { id: ctestId },
            include: { imageQuestions: true },
        });

        if (!ctest) {
            return res.status(404).json({ error: 'CTest not found' });
        }

        if (ctest.mode !== CTestMode.IMAGE) {
            return res.status(400).json({ error: 'CTest is not configured for image submissions' });
        }

        const questionMap = new Map<number, (typeof ctest.imageQuestions)[number]>();
        ctest.imageQuestions.forEach((question) => questionMap.set(question.id, question));

        for (const [index, answer] of answers.entries()) {
            if (!answer || typeof answer !== 'object') {
                return res.status(400).json({ error: `Invalid answer payload at index ${index}` });
            }

            if (typeof answer.questionId !== 'number' || answer.questionId <= 0) {
                return res.status(400).json({ error: `Invalid questionId at index ${index}` });
            }

            const question = questionMap.get(answer.questionId);
            if (!question) {
                return res.status(400).json({ error: `questionId ${answer.questionId} does not belong to this test` });
            }

            if (!Array.isArray(answer.answerImages) || answer.answerImages.length === 0) {
                return res.status(400).json({ error: `answerImages must be a non-empty array at index ${index}` });
            }

            if (answer.answerImages.length > question.maxAnswerImages) {
                return res.status(400).json({ error: `Too many images for questionId ${answer.questionId}. Max allowed ${question.maxAnswerImages}` });
            }

            if (!answer.answerImages.every((img) => typeof img === 'string' && img.trim().length > 0)) {
                return res.status(400).json({ error: `answerImages must contain valid string URLs at index ${index}` });
            }
        }

        const submission = await prisma.ctestSubmission.create({
            data: {
                ctestId,
                endUsersId,
                status: CTestSubmissionStatus.SUBMITTED,
                submittedAt: new Date(),
            },
        });

        await prisma.$transaction(
            answers.map((answer) =>
                prisma.ctestImageAnswer.create({
                    data: {
                        submissionId: submission.id,
                        questionId: answer.questionId,
                        answerImages: answer.answerImages,
                        notes: answer.notes ?? null,
                    },
                })
            )
        );

        // Grant base reward of 20 coins for submission
        let rewardInfo: any = null;
        try {
            const baseReward = 20;
            const taskCode = `CTEST_IMAGE_SUBMIT_${ctestId}_${endUsersId}`;
            const amountDecimal = new Decimal(baseReward);
            const reason = `Image CTest submission reward - Base reward: ${baseReward} coins`;

            const systemWallet = await getSystemWallet();
            if (systemWallet.spendableBalance.lt(amountDecimal)) {
                console.warn(
                    `System wallet has insufficient balance for image ctest submission reward. Available: ${systemWallet.spendableBalance}, Required: ${baseReward}`
                );
                rewardInfo = {
                    coinsEarned: 0,
                    message: "System wallet has insufficient balance",
                    breakdown: {
                        base: baseReward,
                        total: baseReward,
                    },
                };
            } else {
                const rewardReq = {
                    body: {
                        userId: endUsersId,
                        taskCode: taskCode,
                        coinsAmount: baseReward,
                        reason: reason,
                        metadata: {
                            ctestId: ctestId,
                            ctestTitle: ctest.title,
                            submissionId: submission.id,
                            type: "IMAGE_CTEST_SUBMISSION",
                        },
                    },
                } as Request;

                let rewardResponseData: any = null;
                const rewardRes = {
                    json: (data: any) => {
                        rewardResponseData = data;
                    },
                    status: (_code: number) => ({
                        json: (data: any) => {
                            rewardResponseData = data;
                        },
                    }),
                } as unknown as Response;

                await grantTaskReward(rewardReq, rewardRes);

                if (rewardResponseData?.success) {
                    rewardInfo = {
                        coinsEarned: baseReward,
                        message: `Base submission reward: ${baseReward} coins`,
                        breakdown: {
                            base: baseReward,
                            total: baseReward,
                        },
                        userWallet: rewardResponseData.data?.userWallet || null,
                        reward: {
                            reward: rewardResponseData.data?.reward || null,
                            transactions: rewardResponseData.data?.transactions || null,
                        },
                    };
                } else {
                    rewardInfo = {
                        coinsEarned: 0,
                        message: "Reward grant failed",
                        breakdown: {
                            base: baseReward,
                            total: baseReward,
                        },
                    };
                }
            }
        } catch (rewardError) {
            console.error('Error in reward granting logic:', rewardError);
            rewardInfo = {
                coinsEarned: 0,
                message: "Error processing reward",
                error: rewardError instanceof Error ? rewardError.message : "Unknown error",
            };
        }

        res.status(201).json({
            success: true,
            submission,
            reward: rewardInfo,
        });

    } catch (error) {
        console.error('Error creating image ctest submission:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

export async function submitMcqCtest(req: Request, res: Response) {
    const { ctestId, endUsersId, responses,courseId } = req.body;

    if (!ctestId || !endUsersId || !Array.isArray(responses) || !responses.length) {
        return res.status(400).json({ error: "Invalid payload" });
    }

    const ctest = await prisma.ctest.findUnique({
        where: { id: ctestId },
        include: { ctestQuestions: true },
    });

    if (!ctest || ctest.mode !== CTestMode.MCQ) {
        return res.status(400).json({ error: "Not an MCQ test" });
    }

    const already = await prisma.ctestSubmission.findFirst({
        where: { ctestId, endUsersId, status: CTestSubmissionStatus.SUBMITTED },
    });

    if (already) {
        return res.status(409).json({ error: "CTest already attempted" });
    }

    const questionMap = new Map(
        ctest.ctestQuestions.map(q => [q.id, q.correctResponse])
    );

    for (const r of responses) {
        if (!questionMap.has(r.ctestQuestionsId)) {
            return res.status(400).json({ error: "Invalid question" });
        }
    }

    const submission = await prisma.$transaction(async (tx) => {
        const sub = await tx.ctestSubmission.create({
            data: {
                ctestId,
                endUsersId,
                status: CTestSubmissionStatus.SUBMITTED,
                submittedAt: new Date(),
            },
        });

        await tx.cTestResponse.createMany({
            data: responses.map(r => ({
                response: r.response,
                endUsersId,
                ctestQuestionsId: r.ctestQuestionsId,
                ctestId,
                ctestSubmissionId: sub.id,
            })),
        });

        return sub;
    });

    let correct = 0;
    responses.forEach(r => {
        if (questionMap.get(r.ctestQuestionsId) === r.response) correct++;
    });

    const coins = 20 + correct;

    await invalidateCache(`course:ctests:${courseId}:user:${endUsersId}:*`);
    await invalidateCache(`ctest:view:${ctestId}:user:${endUsersId}`);

    return res.status(201).json({
        success: true,
        submissionId: submission.id,
        score: `${correct}/${ctest.ctestQuestions.length}`,
        reward: { coinsEarned: coins },
    });
}

export async function submitImageCtest(req: Request, res: Response) {
    const { ctestId, endUsersId, answers, courseId } = req.body;

    if (!ctestId || !endUsersId || !Array.isArray(answers) || !answers.length) {
        return res.status(400).json({ error: "Invalid payload" });
    }

    const ctest = await prisma.ctest.findUnique({
        where: { id: ctestId },
        include: { imageQuestions: true },
    });

    if (!ctest || ctest.mode !== CTestMode.IMAGE) {
        return res.status(400).json({ error: "Not an image test" });
    }

    const already = await prisma.ctestSubmission.findFirst({
        where: { ctestId, endUsersId, status: CTestSubmissionStatus.SUBMITTED },
    });

    if (already) {
        return res.status(409).json({ error: "CTest already attempted" });
    }

    const questionMap = new Map(
        ctest.imageQuestions.map(q => [q.id, q])
    );

    for (const a of answers) {
        const q = questionMap.get(a.questionId);
        if (!q || a.answerImages.length > q.maxAnswerImages) {
            return res.status(400).json({ error: "Invalid image answer" });
        }
    }

    const submission = await prisma.$transaction(async (tx) => {
        const sub = await tx.ctestSubmission.create({
            data: {
                ctestId,
                endUsersId,
                status: CTestSubmissionStatus.SUBMITTED,
                submittedAt: new Date(),
            },
        });

        await tx.ctestImageAnswer.createMany({
            data: answers.map(a => ({
                submissionId: sub.id,
                questionId: a.questionId,
                answerImages: a.answerImages,
                notes: a.notes ?? null,
            })),
        });

        return sub;
    });

    await invalidateCache(`course:ctests:${courseId}:user:${endUsersId}:*`);
    await invalidateCache(`ctest:view:${ctestId}:user:${endUsersId}`);

    return res.status(201).json({
        success: true,
        submissionId: submission.id,
        reward: {
            coinsEarned: 20,
            message: "Base reward granted. Awaiting evaluation.",
        },
    });
}

export async function viewSubmittedCtest(
    req: Request,
    res: Response
): Promise<void> {
    const { ctestId, endUsersId } = req.body;

    if (!ctestId || !endUsersId) {
        res.status(400).json({
            success: false,
            error: "ctestId and endUsersId are required",
        });
        return;
    }

    const testId = Number(ctestId);
    const userId = Number(endUsersId);

    if (isNaN(testId) || isNaN(userId) || testId <= 0 || userId <= 0) {
        res.status(400).json({
            success: false,
            error: "Invalid ids",
        });
        return;
    }

    const cacheKey = `ctest:view:${testId}:user:${userId}`;

    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            res.json({
                success: true,
                data: cached,
                source: "cache",
            });
            return;
        }

        const submission = await prisma.ctestSubmission.findFirst({
            where: {
                ctestId: testId,
                endUsersId: userId,
                status: {
                    in: [CTestSubmissionStatus.SUBMITTED, CTestSubmissionStatus.GRADED],
                },
            },
            include: {
                cTestResponse: {
                    include: {
                        forQuestion: true,
                    },
                },
                ctest: {
                    include: {
                        ctestQuestions: true,
                        imageQuestions: true,
                    },
                },
            },
        });

        if (!submission) {
            res.status(404).json({
                success: false,
                error: "CTest not attempted yet",
            });
            return;
        }

        const ctest = submission.ctest;
        const result: any = {
            ctestId: testId,
            mode: ctest.mode,
            attemptedAt: submission.submittedAt || submission.createdOn,
            status: submission.status,
            totalMarks: submission.ctest.totalMarks || null,
            awardedMarks: submission.awardedMarks || null,
            gradingNote: submission.gradingNote || null,
            gradedAt: submission.gradedAt || null,
        };

        if (ctest.mode === CTestMode.MCQ) {
            const responseMap = new Map(
                submission.cTestResponse.map((r) => [
                    r.ctestQuestionsId,
                    r.response,
                ])
            );

            let correctCount = 0;
            const questions = ctest.ctestQuestions.map((q) => {
                const userAnswer = responseMap.get(q.id) ?? null;
                const isCorrect = userAnswer === q.correctResponse;

                if (isCorrect) correctCount++;

                return {
                    id: q.id,
                    question: q.question,
                    type: q.type,
                    options: {
                        option1: q.option1,
                        option2: q.option2,
                        option3: q.option3,
                        option4: q.option4,
                    },
                    correctAnswer: q.correctResponse,
                    userAnswer,
                    isCorrect,
                };
            });

            const totalQuestions = questions.length;
            result.totalQuestions = totalQuestions;
            result.correctAnswers = correctCount;
            result.score = `${correctCount}/${totalQuestions}`;
            result.percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
            result.questions = questions;
        } else if (ctest.mode === CTestMode.IMAGE) {
            const imageAnswers = await prisma.ctestImageAnswer.findMany({
                where: {
                    submissionId: submission.id,
                },
                include: {
                    question: true,
                },
            });

            const answerMap = new Map(
                imageAnswers.map((a) => [a.questionId, a])
            );

            const questions = ctest.imageQuestions
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((q) => {
                    const answer = answerMap.get(q.id);
                    return {
                        id: q.id,
                        prompt: q.prompt,
                        instructions: q.instructions,
                        questionImages: q.questionImages,
                        maxMarks: q.maxMarks,
                        maxAnswerImages: q.maxAnswerImages,
                        sortOrder: q.sortOrder,
                        userAnswer: answer
                            ? {
                                answerImages: answer.answerImages,
                                notes: answer.notes,
                                awardedMarks: answer.awardedMarks,
                                reviewComment: answer.reviewComment,
                                reviewedAt: answer.reviewedAt,
                            }
                            : null,
                    };
                });

            const totalQuestions = questions.length;
            const totalMaxMarks = questions.reduce((sum, q) => sum + q.maxMarks, 0);
            const totalAwardedMarks = submission.awardedMarks || 0;

            result.totalQuestions = totalQuestions;
            result.totalMaxMarks = totalMaxMarks;
            result.awardedMarks = totalAwardedMarks;
            result.score = submission.status === CTestSubmissionStatus.GRADED
                ? `${totalAwardedMarks}/${totalMaxMarks}`
                : "Pending evaluation";
            result.percentage =
                submission.status === CTestSubmissionStatus.GRADED && totalMaxMarks > 0
                    ? Math.round((totalAwardedMarks / totalMaxMarks) * 100)
                    : null;
            result.questions = questions;
        }

        await setCache(cacheKey, result, 3600);

        res.json({
            success: true,
            data: result,
            source: "db",
        });
    } catch (error) {
        console.error("viewSubmittedCtest error:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
}

export async function createCtestSubmission2(req: Request, res: Response) {
    try {
        const { ctestId, endUsersId, responses } = req.body as CtestSubmissionPayload;

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

        // Get ctest with questions to calculate score
        const ctest = await prisma.ctest.findUnique({
            where: { id: ctestId },
            include: {
                ctestQuestions: true,
            },
        });

        if (!ctest) {
            return res.status(404).json({ error: 'CTest not found' });
        }

        if (ctest.mode === CTestMode.IMAGE) {
            return res.status(400).json({ error: 'Use createImageCtestSubmission for image-based tests' });
        }

        // Create submission
        const newSubmission = await prisma.ctestSubmission.create({
            data: {
                ctestId: ctestId,
                endUsersId: endUsersId,
            },
        });

        // Create response records
        const responsePromises = responses.map((response: SubmissionResponseInput) =>
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

        // Calculate score and percentage
        const totalQuestions = ctest.ctestQuestions.length;
        let correctAnswers = 0;

        // Create a map of question ID to correct response for quick lookup
        const questionMap = new Map<number, number>();
        ctest.ctestQuestions.forEach((q) => {
            questionMap.set(q.id, q.correctResponse);
        });

        // Count correct answers
        responses.forEach((response) => {
            const correctResponse = questionMap.get(response.ctestQuestionsId);
            if (correctResponse && response.response === correctResponse) {
                correctAnswers++;
            }
        });

        const percentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

        // Grant reward: base 20 coins + 1 coin per correct answer
        let rewardInfo: any = null;

        try {
            const baseReward = 20;
            const correctAnswerBonus = correctAnswers; // 1 coin per correct answer
            const coinsAmount = baseReward + correctAnswerBonus;

            const taskCode = `CTEST_${ctestId}_${endUsersId}`;
            const amountDecimal = new Decimal(coinsAmount);
            const reason = `CTest completion - Base reward: ${baseReward} coins, Correct answer bonus: ${correctAnswerBonus} coins (${correctAnswers}/${totalQuestions} correct)`;

            // Check system wallet balance
            const systemWallet = await getSystemWallet();
            if (systemWallet.spendableBalance.lt(amountDecimal)) {
                console.warn(
                    `System wallet has insufficient balance for ctest reward. Available: ${systemWallet.spendableBalance}, Required: ${coinsAmount}`
                );
                rewardInfo = {
                    coinsEarned: 0,
                    message: "System wallet has insufficient balance",
                    breakdown: {
                        base: baseReward,
                        correctAnswerBonus: correctAnswerBonus,
                        total: coinsAmount,
                    },
                    score: `${correctAnswers}/${totalQuestions}`,
                    percentage: percentage.toFixed(2),
                };
            } else {
                const rewardReq = {
                    body: {
                        userId: endUsersId,
                        taskCode: taskCode,
                        coinsAmount: coinsAmount,
                        reason: reason,
                        metadata: {
                            ctestId: ctestId,
                            ctestTitle: ctest.title,
                            correctAnswers: correctAnswers,
                            totalQuestions: totalQuestions,
                            percentage: percentage,
                        },
                    },
                } as Request;

                let rewardResponseData: any = null;
                const rewardRes = {
                    json: (data: any) => {
                        rewardResponseData = data;
                    },
                    status: (_code: number) => ({
                        json: (data: any) => {
                            rewardResponseData = data;
                        },
                    }),
                } as unknown as Response;

                await grantTaskReward(rewardReq, rewardRes);

                if (rewardResponseData?.success) {
                    rewardInfo = {
                        coinsEarned: coinsAmount,
                        message: `Base reward: ${baseReward} coins, Correct answer bonus: ${correctAnswerBonus} coins`,
                        breakdown: {
                            base: baseReward,
                            correctAnswerBonus: correctAnswerBonus,
                            total: coinsAmount,
                        },
                        score: `${correctAnswers}/${totalQuestions}`,
                        percentage: percentage.toFixed(2),
                        userWallet: rewardResponseData.data?.userWallet || null,
                        reward: {
                            reward: rewardResponseData.data?.reward || null,
                            transactions: rewardResponseData.data?.transactions || null,
                        },
                    };
                } else {
                    rewardInfo = {
                        coinsEarned: 0,
                        message: "Reward grant failed",
                        breakdown: {
                            base: baseReward,
                            correctAnswerBonus: correctAnswerBonus,
                            total: coinsAmount,
                        },
                        score: `${correctAnswers}/${totalQuestions}`,
                        percentage: percentage.toFixed(2),
                    };
                }
            }
        } catch (rewardError) {
            console.error('Error in reward granting logic:', rewardError);
            rewardInfo = {
                coinsEarned: 0,
                message: "Error processing reward",
                error: rewardError instanceof Error ? rewardError.message : "Unknown error",
            };
        }

        res.status(201).json({
            success: true,
            submission: newSubmission,
            reward: rewardInfo,
        });
    } catch (error) {
        console.error('Error creating ctest submission with responses:', error);
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
                    include: { ctestQuestions: true, imageQuestions: true },
                },
                cTestResponse: true,
                imageAnswers: {
                    include: { question: true },
                },
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

export async function GetCtestSubmissionsByTest(req: Request, res: Response) {
    const { ctestId } = req.body;

    if (!ctestId || typeof ctestId !== 'number') {
        res.status(400).json({ success: false, error: 'ctestId is required' });
        return;
    }

    try {
        const submissions = await prisma.ctestSubmission.findMany({
            where: { ctestId },
            include: {
                ctest: {
                    select: {
                        id: true,
                        title: true,
                        mode: true,
                        totalMarks: true,
                        startDate: true,
                        endDate: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        uuid: true,
                        phone: true,
                    },
                },
                cTestResponse: true,
                imageAnswers: {
                    include: { question: true },
                },
            },
            orderBy: [
                { submittedAt: 'desc' },
                { createdOn: 'desc' },
            ],
        });

        res.json({ success: true, submissions, count: submissions.length });
    } catch (error) {
        console.error('Error fetching submissions for ctest:', error);

        if (error instanceof PrismaClientKnownRequestError) {
            res.status(500).json({ success: false, error: error.message });
        } else {
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}

export async function GetCtestSubmissionsByTest2(req: Request, res: Response) {
    const { ctestId } = req.body;

    if (!ctestId || typeof ctestId !== 'number') {
        return res.status(400).json({ success: false, error: 'ctestId is required' });
    }

    try {
        const submissions = await prisma.ctestSubmission.findMany({
            where: { ctestId },
            include: {
                ctest: {
                    select: {
                        id: true,
                        title: true,
                        mode: true,
                        totalMarks: true,
                        startDate: true,
                        endDate: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        uuid: true,
                        phone: true,
                    },
                },
                cTestResponse: true,
                imageAnswers: {
                    include: { question: true },
                },
            },
            orderBy: {
                submittedAt: 'asc', // earliest first
            },
        });

        // 🔹 Deduplicate: keep first submission per user
        const uniqueMap = new Map<number, typeof submissions[0]>();

        for (const submission of submissions) {
            if (!uniqueMap.has(submission.endUsersId)) {
                uniqueMap.set(submission.endUsersId, submission);
            }
        }

        const uniqueSubmissions = Array.from(uniqueMap.values());

        return res.json({
            success: true,
            submissions: uniqueSubmissions,
            count: uniqueSubmissions.length,
        });
    } catch (error) {
        console.error('Error fetching submissions for ctest:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
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
                    include: { ctestQuestions: true, imageQuestions: true },
                },
                cTestResponse: true,
                imageAnswers: {
                    include: { question: true },
                },
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

// Mark a single image answer (per-question marking)
export async function markImageAnswer(req: Request, res: Response) {
    try {
        const { submissionId, questionId, awardedMarks, reviewComment, reviewedBy } = req.body;

        if (typeof submissionId !== 'number' || submissionId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing submissionId' });
        }

        if (typeof questionId !== 'number' || questionId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing questionId' });
        }

        if (typeof awardedMarks !== 'number' || awardedMarks < 0) {
            return res.status(400).json({ error: 'Invalid or missing awardedMarks (must be >= 0)' });
        }

        if (typeof reviewedBy !== 'number' || reviewedBy <= 0) {
            return res.status(400).json({ error: 'Invalid or missing reviewedBy (mentor/admin ID)' });
        }

        // Get the answer and related question to validate maxMarks
        const answer = await prisma.ctestImageAnswer.findUnique({
            where: {
                submissionId_questionId: {
                    submissionId,
                    questionId,
                },
            },
            include: {
                question: true,
            },
        });

        if (!answer) {
            return res.status(404).json({ error: 'Image answer not found for this submission and question' });
        }

        // Validate awardedMarks doesn't exceed maxMarks
        if (awardedMarks > answer.question.maxMarks) {
            return res.status(400).json({
                error: `awardedMarks (${awardedMarks}) cannot exceed maxMarks (${answer.question.maxMarks}) for this question`
            });
        }

        // Get submission to check status
        const submission = await prisma.ctestSubmission.findUnique({
            where: { id: submissionId },
        });

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        if (submission.status === CTestSubmissionStatus.GRADED) {
            return res.status(400).json({ error: 'Cannot modify marks for a graded submission' });
        }

        // Update the answer with marks
        const updatedAnswer = await prisma.ctestImageAnswer.update({
            where: {
                submissionId_questionId: {
                    submissionId,
                    questionId,
                },
            },
            data: {
                awardedMarks,
                reviewedBy,
                reviewedAt: new Date(),
                reviewComment: reviewComment || null,
            },
            include: {
                question: true,
            },
        });

        res.status(200).json({
            success: true,
            answer: updatedAnswer,
            message: 'Marks awarded successfully',
        });
    } catch (error) {
        console.error('Error marking image answer:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

// Finalize image CTest submission and calculate total marks + percentage-based reward
export async function finalizeImageCtestSubmission(req: Request, res: Response) {
    try {
        const { submissionId, gradedBy } = req.body;

        if (typeof submissionId !== 'number' || submissionId <= 0) {
            return res.status(400).json({ error: 'Invalid or missing submissionId' });
        }

        if (typeof gradedBy !== 'number' || gradedBy <= 0) {
            return res.status(400).json({ error: 'Invalid or missing gradedBy (mentor/admin ID)' });
        }

        // Get submission with all related data
        const submission = await prisma.ctestSubmission.findUnique({
            where: { id: submissionId },
            include: {
                ctest: {
                    include: {
                        imageQuestions: true,
                    },
                },
                imageAnswers: {
                    include: {
                        question: true,
                    },
                },
            },
        });

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        if (submission.ctest.mode !== CTestMode.IMAGE) {
            return res.status(400).json({ error: 'This submission is not for an image CTest' });
        }

        if (submission.status === CTestSubmissionStatus.GRADED) {
            return res.status(400).json({ error: 'Submission is already graded' });
        }

        // Check if all questions have been marked
        const allQuestions = submission.ctest.imageQuestions;
        const answeredQuestions = submission.imageAnswers;

        // Check if all questions have awardedMarks
        const unmarkedAnswers = answeredQuestions.filter(a => a.awardedMarks === null);
        if (unmarkedAnswers.length > 0) {
            return res.status(400).json({
                error: `Cannot finalize: ${unmarkedAnswers.length} question(s) are not yet marked`,
                unmarkedQuestionIds: unmarkedAnswers.map(a => a.questionId),
            });
        }

        // Calculate total awarded marks
        const totalAwarded = answeredQuestions.reduce(
            (sum, answer) => sum + (answer.awardedMarks || 0),
            0
        );

        // Calculate total possible marks
        const totalPossible = allQuestions.reduce(
            (sum, question) => sum + question.maxMarks,
            0
        );

        // Calculate percentage
        const percentage = totalPossible > 0 ? (totalAwarded / totalPossible) * 100 : 0;

        // Calculate percentage-based reward (10% = 1 coin, so 60% = 6 coins)
        const percentageCoins = Math.floor(percentage / 10);

        // Update submission with final marks
        const updatedSubmission = await prisma.ctestSubmission.update({
            where: { id: submissionId },
            data: {
                status: CTestSubmissionStatus.GRADED,
                awardedMarks: totalAwarded,
                gradedAt: new Date(),
                gradedBy: gradedBy,
            },
        });

        // Grant percentage-based reward
        let rewardInfo: any = null;
        try {
            if (percentageCoins > 0) {
                const taskCode = `CTEST_IMAGE_FINALIZE_${submission.ctest.id}_${submission.endUsersId}`;
                const amountDecimal = new Decimal(percentageCoins);
                const reason = `Image CTest finalization reward - Percentage: ${percentage.toFixed(2)}%, Reward: ${percentageCoins} coins`;

                const systemWallet = await getSystemWallet();
                if (systemWallet.spendableBalance.lt(amountDecimal)) {
                    console.warn(
                        `System wallet has insufficient balance for image ctest finalization reward. Available: ${systemWallet.spendableBalance}, Required: ${percentageCoins}`
                    );
                    rewardInfo = {
                        coinsEarned: 0,
                        message: "System wallet has insufficient balance",
                        breakdown: {
                            percentage: percentage.toFixed(2),
                            percentageCoins: percentageCoins,
                            total: percentageCoins,
                        },
                    };
                } else {
                    const rewardReq = {
                        body: {
                            userId: submission.endUsersId,
                            taskCode: taskCode,
                            coinsAmount: percentageCoins,
                            reason: reason,
                            metadata: {
                                ctestId: submission.ctest.id,
                                ctestTitle: submission.ctest.title,
                                submissionId: submission.id,
                                totalAwarded: totalAwarded,
                                totalPossible: totalPossible,
                                percentage: percentage,
                                type: "IMAGE_CTEST_FINALIZATION",
                            },
                        },
                    } as Request;

                    let rewardResponseData: any = null;
                    const rewardRes = {
                        json: (data: any) => {
                            rewardResponseData = data;
                        },
                        status: (_code: number) => ({
                            json: (data: any) => {
                                rewardResponseData = data;
                            },
                        }),
                    } as unknown as Response;

                    await grantTaskReward(rewardReq, rewardRes);

                    if (rewardResponseData?.success) {
                        rewardInfo = {
                            coinsEarned: percentageCoins,
                            message: `Finalization reward: ${percentageCoins} coins (${percentage.toFixed(2)}%)`,
                            breakdown: {
                                percentage: percentage.toFixed(2),
                                percentageCoins: percentageCoins,
                                total: percentageCoins,
                            },
                            userWallet: rewardResponseData.data?.userWallet || null,
                            reward: {
                                reward: rewardResponseData.data?.reward || null,
                                transactions: rewardResponseData.data?.transactions || null,
                            },
                        };
                    } else {
                        rewardInfo = {
                            coinsEarned: 0,
                            message: "Reward grant failed",
                            breakdown: {
                                percentage: percentage.toFixed(2),
                                percentageCoins: percentageCoins,
                                total: percentageCoins,
                            },
                        };
                    }
                }
            } else {
                rewardInfo = {
                    coinsEarned: 0,
                    message: `No reward (percentage ${percentage.toFixed(2)}% is below 10%)`,
                    breakdown: {
                        percentage: percentage.toFixed(2),
                        percentageCoins: 0,
                        total: 0,
                    },
                };
            }
        } catch (rewardError) {
            console.error('Error in reward granting logic:', rewardError);
            rewardInfo = {
                coinsEarned: 0,
                message: "Error processing reward",
                error: rewardError instanceof Error ? rewardError.message : "Unknown error",
            };
        }

        res.status(200).json({
            success: true,
            submission: updatedSubmission,
            marks: {
                totalAwarded,
                totalPossible,
                percentage: percentage.toFixed(2),
            },
            reward: rewardInfo,
        });
    } catch (error) {
        console.error('Error finalizing image ctest submission:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
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
        await prisma.ctestImageAnswer.deleteMany({ where: { submission: { ctestId: id } } });
        await prisma.ctestSubmission.deleteMany({ where: { ctestId: id } });
        await prisma.ctestImageQuestion.deleteMany({ where: { ctestId: id } });
        await prisma.ctestQuestions.deleteMany({ where: { ctestId: id } });

        await prisma.ctest.delete({ where: { id } });

        return res.status(200).json({ message: 'CTest and related data deleted successfully' });
    } catch (error) {
        console.error('Error deleting ctest:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export async function GetCourseTests(req: Request, res: Response) {
    const { courseId, userId, page = 1 } = req.body;

    if (!courseId || !userId) {
        return res.status(400).json({
            success: false,
            error: "courseId and userId are required",
        });
    }

    const LIMIT = 20;
    const offset = (Number(page) - 1) * LIMIT;

    const cacheKey = `course:ctests:${courseId}:user:${userId}:page:${page}`;

    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                tests: cached.tests,
                pagination: cached.pagination,
                source: "cache",
            });
        }

        const [tests, total] = await Promise.all([
            prisma.ctest.findMany({
                where: {
                    bigCourseId: Number(courseId),
                },
                select: {
                    id: true,
                    title: true,
                    startDate: true,
                    endDate: true,
                    mode: true,
                    totalMarks: true,
                    subject: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    ctestSubmission: {
                        where: {
                            endUsersId: Number(userId),
                        },
                        select: {
                            status: true,
                        },
                        take: 1,
                    },
                },
                orderBy: {
                    startDate: "desc",
                },
                skip: offset,
                take: LIMIT,
            }),

            prisma.ctest.count({
                where: {
                    bigCourseId: Number(courseId),
                },
            }),
        ]);

        const formattedTests = tests.map((test) => ({
            ctestId: test.id,
            title: test.title,
            startDate: test.startDate,
            endDate: test.endDate,
            mode: test.mode,
            totalMarks: test.totalMarks,
            subject: test.subject,
            attemptStatus:
                test.ctestSubmission.length > 0
                    ? test.ctestSubmission[0].status
                    : "NOT_ATTEMPTED",
        }));

        const pagination = {
            page: Number(page),
            limit: LIMIT,
            hasNext: offset + LIMIT < total,
        };

        const payload = {
            tests: formattedTests,
            pagination,
        };

        await setCache(cacheKey, payload, 900); // 15 min

        return res.json({
            success: true,
            tests: formattedTests,
            pagination,
            source: "db",
        });
    } catch (error) {
        console.error("GetCourseTests error:", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
}

export async function GetCourseTestQuestions(
    req: Request,
    res: Response
) {
    const { courseTestId, userId } = req.body;

    if (!courseTestId || !userId) {
        return res.status(400).json({
            success: false,
            error: "courseTestId and userId are required",
        });
    }

    const cacheKey = `courseTest:questions:${courseTestId}`;

    try {
        const attempted = await prisma.ctestSubmission.findFirst({
            where: {
                ctestId: Number(courseTestId),
                endUsersId: Number(userId),
                status: "SUBMITTED",
            },
            select: { id: true },
        });

        if (attempted) {
            return res.status(403).json({
                success: false,
                error: "Course test already submitted",
            });
        }

        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                data: cached,
                source: "cache",
            });
        }

        const test = await prisma.ctest.findUnique({
            where: { id: Number(courseTestId) },
            select: {
                id: true,
                title: true,
                Duration: true,
                totalMarks: true,
                mode: true,

                /* MCQ questions only */
                ctestQuestions: {
                    where: {
                        isSubjective: false,
                    },
                    select: {
                        id: true,
                        question: true,
                        option1: true,
                        option2: true,
                        option3: true,
                        option4: true,
                    },
                },

                /* Image questions */
                imageQuestions: {
                    select: {
                        id: true,
                        prompt: true,
                        instructions: true,
                        questionImages: true,
                        maxMarks: true,
                        maxAnswerImages: true,
                        sortOrder: true,
                    },
                    orderBy: {
                        sortOrder: "asc",
                    },
                },
            },
        });

        if (!test) {
            return res.status(404).json({
                success: false,
                error: "Course test not found",
            });
        }

        /* ---------- normalize ---------- */
        const mcqQuestions = test.ctestQuestions.map((q) => ({
            id: q.id,
            type: "MCQ",
            question: q.question,
            options: [
                q.option1,
                q.option2,
                q.option3,
                q.option4,
            ].filter(Boolean),
        }));

        const imageQuestions = test.imageQuestions.map((q) => ({
            id: q.id,
            type: "IMAGE",
            prompt: q.prompt,
            instructions: q.instructions,
            images: q.questionImages,
            maxMarks: q.maxMarks,
            maxAnswerImages: q.maxAnswerImages,
        }));

        const payload = {
            test: {
                id: test.id,
                title: test.title,
                duration: test.Duration,
                totalMarks: test.totalMarks,
                mode: test.mode,
            },
            mcqQuestions,
            imageQuestions,
        };

        await setCache(cacheKey, payload, 900); // 15 min

        return res.json({
            success: true,
            data: payload,
            source: "db",
        });
    } catch (error) {
        console.error("GetCourseTestQuestions error:", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
}