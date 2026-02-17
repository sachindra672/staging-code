import { prisma } from './misc'
import { Request, Response } from 'express'
import { getUserSubjectFilter } from './utils/subscriptionUtils';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Storage } from "@google-cloud/storage";
import { nanoid } from "nanoid";
import { grantTaskReward } from './sisyacoin/taskRewardController'
import { getSystemWallet } from './config/sisyacoinHelperFunctions'
import { Decimal } from "@prisma/client/runtime/library";
import { CTestMode, CTestSubmissionStatus } from '@prisma/client';
import { invalidateCache } from './utils/cacheUtils';

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

type CTestSectionInput = {
    subjectId: number
    duration: number
    title?: string
    sortOrder?: number
    ctestQuestions?: McqQuestionInput[]
    imageQuestions?: ImageQuestionInput[]
}

type CreateCtestPayloadV2 = {
    title: string
    startDate: string
    bigCourseId: number
    mentorId: number
    sections: CTestSectionInput[]
    totalMarks?: number
}

type UpdateCtestPayload = CreateCtestPayload & {
    ctestId: number
}

type UpdateCtestPayloadV2 = CreateCtestPayloadV2 & {
    ctestId: number
}

type UnifiedCtestSubmissionPayload = {
    ctestId: number
    endUsersId: number
    mcqResponses?: SubmissionResponseInput[]
    imageAnswers?: {
        questionId: number
        answerImages: string[]
        notes?: string
    }[]
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

        // Invalidate cache for course test questions
        await invalidateCache(`courseTest:questions:${newCtest.id}`);
        await invalidateCache(`course:ctests:${bigCourseId}:*`);

        res.status(201).json({ success: true, newCtest });
    } catch (error) {
        console.error('Error creating ctest with questions:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

export async function createCtest2(req: Request, res: Response) {
    try {
        const payload = req.body as CreateCtestPayloadV2;
        const {
            title,
            startDate,
            bigCourseId,
            mentorId,
            sections,
            totalMarks: providedTotalMarks,
        } = payload;

        if (!title || typeof title !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing title' });
        }

        if (!startDate || isNaN(Date.parse(startDate))) {
            return res.status(400).json({ error: 'Invalid or missing startDate' });
        }

        if (!Array.isArray(sections) || sections.length === 0) {
            // Fallback to old structure if sections are missing for backward compatibility
            // This is optional but good for preventing breaks if some old clients exist
            const oldPayload = req.body as CreateCtestPayload;
            if (oldPayload.subjectId && (oldPayload.ctestQuestions || oldPayload.imageQuestions)) {
                // You might want to handle this or just return error
                return res.status(400).json({ error: 'Sections array is required in V2' });
            }
            return res.status(400).json({ error: 'Invalid or missing sections' });
        }

        const start = new Date(startDate);
        let totalDuration = 0;
        let calculatedTotalMarks = 0;

        // Validate sections and calculate totals
        for (const [sIndex, section] of sections.entries()) {
            if (!section.subjectId || typeof section.duration !== 'number') {
                return res.status(400).json({ error: `Invalid subjectId or duration in section at index ${sIndex}` });
            }
            totalDuration += section.duration;

            if (section.ctestQuestions) {
                for (const q of section.ctestQuestions) {
                    calculatedTotalMarks += 1; // Basic MCQ mark = 1
                }
            }

            if (section.imageQuestions) {
                for (const iq of section.imageQuestions) {
                    calculatedTotalMarks += (iq.maxMarks || 0);
                }
            }
        }

        const end = new Date(start.getTime() + totalDuration * 60000);

        const newCtest = await prisma.$transaction(async (tx) => {
            const firstSectionSubjectId = sections[0].subjectId;

            const test = await tx.ctest.create({
                data: {
                    title,
                    startDate: start,
                    endDate: end,
                    Duration: totalDuration,
                    bigCourseId: Number(bigCourseId),
                    mentorId: Number(mentorId),
                    subjectId: firstSectionSubjectId, // Sync top-level subjectId
                    mode: CTestMode.COMBINED,
                    totalMarks: providedTotalMarks || calculatedTotalMarks || null,
                }
            });

            for (const [sIndex, section] of sections.entries()) {
                await tx.cTestSection.create({
                    data: {
                        ctestId: test.id,
                        subjectId: section.subjectId,
                        duration: section.duration,
                        title: section.title || `Section ${sIndex + 1}`,
                        sortOrder: section.sortOrder ?? sIndex,
                        mcqQuestions: {
                            create: (section.ctestQuestions || []).map((q) => ({
                                question: q.question,
                                type: q.type,
                                option1: q.option1 || null,
                                option2: q.option2 || null,
                                option3: q.option3 || null,
                                option4: q.option4 || null,
                                correctResponse: q.type === 'subjective' ? 0 : (q.correctResponse || 0),
                                isSubjective: q.type === 'subjective',
                                maxWords: q.maxWords || null,
                                allowAttachments: q.allowAttachments ?? false,
                                ctestId: test.id,
                            })),
                        },
                        imageQuestions: {
                            create: (section.imageQuestions || []).map((iq, iIndex) => ({
                                prompt: iq.prompt ?? null,
                                instructions: iq.instructions ?? null,
                                questionImages: iq.questionImages ?? [],
                                maxMarks: iq.maxMarks,
                                maxAnswerImages: iq.maxAnswerImages ?? 5,
                                sortOrder: iq.sortOrder ?? iIndex,
                                ctestId: test.id,
                            })),
                        }
                    }
                });
            }

            const created = await tx.ctest.findUnique({
                where: { id: test.id },
                include: {
                    sections: {
                        include: {
                            subject: { select: { id: true, name: true } },
                            mcqQuestions: true,
                            imageQuestions: true,
                        },
                        orderBy: { sortOrder: 'asc' }
                    },
                    subject: { select: { id: true, name: true } }
                }
            });

            if (!created) return null;

            // Format sections to have unified questions array
            const formattedSections = created.sections.map(s => {
                const unifiedQuestions = [
                    ...s.mcqQuestions.map(q => ({
                        id: q.id,
                        type: "MCQ",
                        question: q.question,
                        options: [q.option1, q.option2, q.option3, q.option4].filter(Boolean),
                        correctResponse: q.correctResponse,
                        isSubjective: q.isSubjective,
                        maxWords: q.maxWords,
                        allowAttachments: q.allowAttachments
                    })),
                    ...s.imageQuestions.map(q => ({
                        id: q.id,
                        type: "IMAGE",
                        prompt: q.prompt,
                        instructions: q.instructions,
                        images: q.questionImages,
                        maxMarks: q.maxMarks,
                        maxAnswerImages: q.maxAnswerImages,
                        sortOrder: q.sortOrder,
                    }))
                ];

                return {
                    id: s.id,
                    title: s.title,
                    duration: s.duration,
                    subject: s.subject,
                    questions: unifiedQuestions,
                    totalQuestions: unifiedQuestions.length
                };
            });

            return {
                ...created,
                sections: formattedSections
            };
        });

        if (!newCtest) throw new Error("Failed to create CTest");

        // Invalidate cache
        await invalidateCache(`courseTest:questions:${newCtest.id}`);
        await invalidateCache(`course:ctests:${bigCourseId}:*`);

        res.status(201).json({ success: true, newCtest });

    } catch (error) {
        console.error('Error creating multi-subject ctest:', error);
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

        // Invalidate cache for course test questions
        await invalidateCache(`courseTest:questions:${ctestId}`);
        await invalidateCache(`course:ctests:${bigCourseId}:*`);

        return res.status(200).json({ success: true, updatedCtest });
    } catch (error) {
        console.error('Error updating ctest:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

export async function editCtest2(req: Request, res: Response) {
    try {
        const payload = req.body as UpdateCtestPayloadV2;
        const {
            ctestId,
            title,
            startDate,
            bigCourseId,
            mentorId,
            sections,
            totalMarks: providedTotalMarks,
        } = payload;

        if (!ctestId) {
            return res.status(400).json({ error: 'Missing ctestId' });
        }

        if (!title || typeof title !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing title' });
        }

        if (!startDate || isNaN(Date.parse(startDate))) {
            return res.status(400).json({ error: 'Invalid or missing startDate' });
        }

        if (!Array.isArray(sections) || sections.length === 0) {
            return res.status(400).json({ error: 'Invalid or missing sections' });
        }

        const start = new Date(startDate);
        let totalDuration = 0;
        let calculatedTotalMarks = 0;

        // Validate sections and calculate totals
        for (const [sIndex, section] of sections.entries()) {
            if (!section.subjectId || typeof section.duration !== 'number') {
                return res.status(400).json({ error: `Invalid subjectId or duration in section at index ${sIndex}` });
            }
            totalDuration += section.duration;

            if (section.ctestQuestions) {
                for (const q of section.ctestQuestions) {
                    calculatedTotalMarks += 1;
                }
            }
            if (section.imageQuestions) {
                for (const iq of section.imageQuestions) {
                    calculatedTotalMarks += (iq.maxMarks || 0);
                }
            }
        }

        const end = new Date(start.getTime() + totalDuration * 60000);

        const updatedCtest = await prisma.$transaction(async (tx) => {
            // 1. Delete old structure
            await tx.ctestQuestions.deleteMany({ where: { ctestId } });
            await tx.ctestImageQuestion.deleteMany({ where: { ctestId } });
            await tx.cTestSection.deleteMany({ where: { ctestId } });

            const firstSectionSubjectId = sections[0].subjectId;

            // 2. Update parent
            await tx.ctest.update({
                where: { id: ctestId },
                data: {
                    title,
                    startDate: start,
                    endDate: end,
                    Duration: totalDuration,
                    bigCourseId: Number(bigCourseId),
                    mentorId: Number(mentorId),
                    subjectId: firstSectionSubjectId, // Sync top-level subjectId
                    mode: CTestMode.COMBINED,
                    totalMarks: providedTotalMarks || calculatedTotalMarks || null,
                    modifiedOn: new Date(),
                }
            });

            // 3. Create new sections
            for (const [sIndex, section] of sections.entries()) {
                await tx.cTestSection.create({
                    data: {
                        ctestId: ctestId,
                        subjectId: section.subjectId,
                        duration: section.duration,
                        title: section.title || `Section ${sIndex + 1}`,
                        sortOrder: section.sortOrder ?? sIndex,
                        mcqQuestions: {
                            create: (section.ctestQuestions || []).map((q) => ({
                                question: q.question,
                                type: q.type,
                                option1: q.option1 || null,
                                option2: q.option2 || null,
                                option3: q.option3 || null,
                                option4: q.option4 || null,
                                correctResponse: q.type === 'subjective' ? 0 : (q.correctResponse || 0),
                                isSubjective: q.type === 'subjective',
                                maxWords: q.maxWords || null,
                                allowAttachments: q.allowAttachments ?? false,
                                ctestId: ctestId,
                            })),
                        },
                        imageQuestions: {
                            create: (section.imageQuestions || []).map((iq, iIndex) => ({
                                prompt: iq.prompt ?? null,
                                instructions: iq.instructions ?? null,
                                questionImages: iq.questionImages ?? [],
                                maxMarks: iq.maxMarks,
                                maxAnswerImages: iq.maxAnswerImages ?? 5,
                                sortOrder: iq.sortOrder ?? iIndex,
                                ctestId: ctestId,
                            })),
                        }
                    }
                });
            }

            const updated = await tx.ctest.findUnique({
                where: { id: ctestId },
                include: {
                    sections: {
                        include: {
                            subject: { select: { id: true, name: true } },
                            mcqQuestions: true,
                            imageQuestions: true,
                        },
                        orderBy: { sortOrder: 'asc' }
                    },
                    subject: { select: { id: true, name: true } }
                }
            });

            if (!updated) return null;

            // Format sections to have unified questions array
            const formattedSections = updated.sections.map(s => {
                const unifiedQuestions = [
                    ...s.mcqQuestions.map(q => ({
                        id: q.id,
                        type: "MCQ",
                        question: q.question,
                        options: [q.option1, q.option2, q.option3, q.option4].filter(Boolean),
                        correctResponse: q.correctResponse,
                        isSubjective: q.isSubjective,
                        maxWords: q.maxWords,
                        allowAttachments: q.allowAttachments
                    })),
                    ...s.imageQuestions.map(q => ({
                        id: q.id,
                        type: "IMAGE",
                        prompt: q.prompt,
                        instructions: q.instructions,
                        images: q.questionImages,
                        maxMarks: q.maxMarks,
                        maxAnswerImages: q.maxAnswerImages,
                        sortOrder: q.sortOrder,
                    }))
                ];

                return {
                    id: s.id,
                    title: s.title,
                    duration: s.duration,
                    subject: s.subject,
                    questions: unifiedQuestions,
                    totalQuestions: unifiedQuestions.length
                };
            });

            return {
                ...updated,
                sections: formattedSections
            };
        });

        // Invalidate cache
        await invalidateCache(`courseTest:questions:${ctestId}`);
        await invalidateCache(`course:ctests:${bigCourseId}:*`);

        res.status(200).json({ success: true, updatedCtest });

    } catch (error) {
        console.error('Error editing multi-subject ctest:', error);
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
    const { ctestId, endUsersId, responses, courseId } = req.body;

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
): Promise<any> {
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

    try {
        const submission = await prisma.ctestSubmission.findFirst({
            where: {
                ctestId: testId,
                endUsersId: userId,
                status: {
                    in: [CTestSubmissionStatus.SUBMITTED, CTestSubmissionStatus.GRADED],
                },
            },
            include: {
                ctest: {
                    select: {
                        id: true,
                        title: true,
                        bigCourseId: true,
                        mode: true,
                        totalMarks: true,
                    }
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

        const subjectFilter = await getUserSubjectFilter(req.user || userId, req.role || 'user', submission.ctest.bigCourseId);

        // Fetch detailed test data with authorized sections and responses
        const testData = await prisma.ctest.findUnique({
            where: { id: testId },
            include: {
                sections: {
                    where: subjectFilter,
                    include: {
                        subject: { select: { id: true, name: true } },
                        mcqQuestions: {
                            where: { isSubjective: false },
                        },
                        imageQuestions: true
                    },
                    orderBy: { sortOrder: "asc" }
                },
                ctestQuestions: {
                    where: { isSubjective: false, test: subjectFilter }
                },
                imageQuestions: {
                    where: { test: subjectFilter }
                },
                cTestResponse: {
                    where: { ctestSubmissionId: submission.id },
                }
            }
        });

        if (!testData) {
            res.status(404).json({ success: false, error: "Test content not accessible" });
            return;
        }

        const imageAnswers = await prisma.ctestImageAnswer.findMany({
            where: { submissionId: submission.id }
        });

        const mcqResponseMap = new Map(testData.cTestResponse.map(r => [r.ctestQuestionsId, r.response]));
        const imageAnswerMap = new Map(imageAnswers.map(a => [a.questionId, a]));

        let dynamicTotalMarks = 0;
        let dynamicAwardedMarks = 0;
        let isFullyGraded = true; // Default to true, will be false if any question is pending grade

        const sectionsPayload = [];

        // Map Sections
        for (const s of testData.sections) {
            const mcqs = s.mcqQuestions.map(q => {
                const userAnswer = mcqResponseMap.get(q.id) ?? null;
                const isCorrect = userAnswer === q.correctResponse;
                dynamicTotalMarks += 1;
                if (isCorrect) dynamicAwardedMarks += 1;

                return {
                    id: q.id,
                    type: "MCQ",
                    question: q.question,
                    options: [q.option1, q.option2, q.option3, q.option4].filter(Boolean),
                    correctAnswer: q.correctResponse,
                    userAnswer,
                    isCorrect: isCorrect
                };
            });

            const images = s.imageQuestions.map(q => {
                const answer = imageAnswerMap.get(q.id);
                dynamicTotalMarks += (q.maxMarks || 0);
                if (answer && answer.awardedMarks !== null) {
                    dynamicAwardedMarks += answer.awardedMarks;
                } else {
                    isFullyGraded = false;
                }

                return {
                    id: q.id,
                    type: "IMAGE",
                    prompt: q.prompt,
                    instructions: q.instructions,
                    questionImages: q.questionImages,
                    maxMarks: q.maxMarks,
                    userAnswer: answer ? {
                        answerImages: answer.answerImages,
                        notes: answer.notes,
                        awardedMarks: answer.awardedMarks,
                        reviewComment: answer.reviewComment
                    } : null
                };
            });

            sectionsPayload.push({
                id: s.id,
                title: s.title,
                subject: s.subject,
                questions: [...mcqs, ...images]
            });
        }

        // Handle Legacy/General if no sections
        if (testData.sections.length === 0) {
            const mcqs = testData.ctestQuestions.map(q => {
                const userAnswer = mcqResponseMap.get(q.id) ?? null;
                const isCorrect = userAnswer === q.correctResponse;
                dynamicTotalMarks += 1;
                if (isCorrect) dynamicAwardedMarks += 1;

                return {
                    id: q.id,
                    type: "MCQ",
                    question: q.question,
                    options: [q.option1, q.option2, q.option3, q.option4].filter(Boolean),
                    correctAnswer: q.correctResponse,
                    userAnswer,
                    isCorrect: isCorrect
                };
            });

            const images = testData.imageQuestions.map(q => {
                const answer = imageAnswerMap.get(q.id);
                dynamicTotalMarks += (q.maxMarks || 0);
                if (answer && answer.awardedMarks !== null) {
                    dynamicAwardedMarks += answer.awardedMarks;
                } else {
                    isFullyGraded = false;
                }

                return {
                    id: q.id,
                    type: "IMAGE",
                    prompt: q.prompt,
                    instructions: q.instructions,
                    questionImages: q.questionImages,
                    maxMarks: q.maxMarks,
                    userAnswer: answer ? {
                        answerImages: answer.answerImages,
                        notes: answer.notes,
                        awardedMarks: answer.awardedMarks,
                        reviewComment: answer.reviewComment
                    } : null
                };
            });

            if (mcqs.length > 0 || images.length > 0) {
                sectionsPayload.push({
                    id: 0,
                    title: "General",
                    questions: [...mcqs, ...images]
                });
            }
        }

        const result: any = {
            ctestId: testId,
            title: testData.title,
            mode: testData.mode,
            attemptedAt: submission.submittedAt || submission.createdOn,
            status: submission.status,
            totalMarks: dynamicTotalMarks,
            awardedMarks: dynamicAwardedMarks,
            score: `${dynamicAwardedMarks}/${dynamicTotalMarks}`,
            percentage: dynamicTotalMarks > 0 ? Math.round((dynamicAwardedMarks / dynamicTotalMarks) * 100) : 0,
            sections: sectionsPayload
        };

        return res.json({
            success: true,
            data: result,
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
    const { ctestId, bigCourseId: providedBigCourseId } = req.body;

    if (!ctestId || typeof ctestId !== 'number') {
        res.status(400).json({ success: false, error: 'ctestId is required' });
        return;
    }

    try {
        // Fetch test context for marks and filtering
        const testBase = await prisma.ctest.findUnique({
            where: { id: ctestId },
            select: { bigCourseId: true }
        });

        if (!testBase) {
            return res.status(404).json({ success: false, error: 'CTest not found' });
        }

        const bigCourseId = providedBigCourseId || testBase.bigCourseId;
        const userId = (req as any).user?.uuid || (req as any).user?.id || 0;
        const role = (req as any).role || 'user';

        // Get authorized sections/questions
        const subjectFilter = await getUserSubjectFilter(req.user || userId, role, Number(bigCourseId));

        const testData = await prisma.ctest.findUnique({
            where: { id: ctestId },
            include: {
                sections: {
                    where: subjectFilter,
                    include: {
                        mcqQuestions: { where: { isSubjective: false } },
                        imageQuestions: true,
                    },
                    orderBy: { sortOrder: 'asc' }
                },
                ctestQuestions: {
                    where: { isSubjective: false, test: subjectFilter }
                },
                imageQuestions: {
                    where: { test: subjectFilter }
                }
            }
        });

        if (!testData) return res.status(403).json({ success: false, error: 'Access denied' });

        // Build list of authorized question IDs
        const authorizedMcqIds = new Set<number>();
        const authorizedImageIds = new Set<number>();

        testData.sections.forEach(s => {
            s.mcqQuestions.forEach(q => authorizedMcqIds.add(q.id));
            s.imageQuestions.forEach(q => authorizedImageIds.add(q.id));
        });
        testData.ctestQuestions.forEach(q => authorizedMcqIds.add(q.id));
        testData.imageQuestions.forEach(q => authorizedImageIds.add(q.id));

        const submissions = await prisma.ctestSubmission.findMany({
            where: { ctestId },
            include: {
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
                imageAnswers: true,
            },
            orderBy: [
                { submittedAt: 'desc' },
                { createdOn: 'desc' },
            ],
        });

        // Calculate dynamic scores for each submission
        const formattedSubmissions = submissions.map(sub => {
            let dynamicTotalMarks = 0;
            let dynamicAwardedMarks = 0;

            // MCQs calculation
            sub.cTestResponse.forEach(resp => {
                if (authorizedMcqIds.has(resp.ctestQuestionsId)) {
                    dynamicTotalMarks += 1;
                    // Find question for correct response if not already in response
                    // In a real scenario, we'd ideally include correctResponse in the query or fetch separately
                    // For now, we'll try to match it against testData if possible, or assumeresp has enough info
                    // Wait, cTestResponse doesn't store if it was correct, usually we check at submission time
                    // However, rewarded marks are stored in ctestSubmission. 
                    // To accurately recalculate awardedMarks for ONLY authorized subjects, we'd need the correctResponse
                }
            });

            // If it's student viewing, we might just want to return the pre-calculated submission totals 
            // BUT those totals were for EVERYTHING at submission time.
            // If the user wants "student subject filtering", they want the score adjusted for only authorized subjects.

            // To do this properly without heavy loops, we check the stored cTestResponse correctness.
            // Let's assume we need to provide a score that reflects only what the VIEWER can see.

            // Re-fetch question responses with correct answers for filtering
            // (Optimization: we already have testData which has correctResponses for MCQs)
            const mcqMap = new Map();
            testData.sections.forEach(s => s.mcqQuestions.forEach(q => mcqMap.set(q.id, q.correctResponse)));
            testData.ctestQuestions.forEach(q => mcqMap.set(q.id, q.correctResponse));

            const imgMap = new Map();
            testData.sections.forEach(s => s.imageQuestions.forEach(q => imgMap.set(q.id, q.maxMarks || 0)));
            testData.imageQuestions.forEach(q => imgMap.set(q.id, q.maxMarks || 0));

            sub.cTestResponse.forEach(resp => {
                const correctResponse = mcqMap.get(resp.ctestQuestionsId);
                if (correctResponse !== undefined) {
                    dynamicTotalMarks += 1;
                    if (resp.response === correctResponse) dynamicAwardedMarks += 1;
                }
            });

            sub.imageAnswers.forEach(ans => {
                const maxMarks = imgMap.get(ans.questionId);
                if (maxMarks !== undefined) {
                    dynamicTotalMarks += maxMarks;
                    if (ans.awardedMarks !== null) dynamicAwardedMarks += ans.awardedMarks;
                }
            });

            return {
                ...sub,
                totalMarks: dynamicTotalMarks,
                awardedMarks: dynamicAwardedMarks,
                score: `${dynamicAwardedMarks}/${dynamicTotalMarks}`
            };
        });

        res.json({ success: true, submissions: formattedSubmissions, count: formattedSubmissions.length });
    } catch (error) {
        console.error('Error fetching submissions for ctest:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

export async function GetCtestSubmissionsByTest2(req: Request, res: Response) {
    const { ctestId, bigCourseId: providedBigCourseId } = req.body;

    if (!ctestId || typeof ctestId !== 'number') {
        return res.status(400).json({ success: false, error: 'ctestId is required' });
    }

    try {
        // Fetch test context
        const testBase = await prisma.ctest.findUnique({
            where: { id: ctestId },
            select: { bigCourseId: true }
        });

        if (!testBase) return res.status(404).json({ success: false, error: 'CTest not found' });

        const bigCourseId = providedBigCourseId || testBase.bigCourseId;
        const role = (req as any).role || 'user';

        // For TEACHERS: Fetch FULL test data (no filtering)
        // For STUDENTS: This still applies their filter (but this API should only be called by teachers)
        const isTeacher = role !== 'user';

        const testData = await prisma.ctest.findUnique({
            where: { id: ctestId },
            include: {
                sections: {
                    include: {
                        mcqQuestions: { where: { isSubjective: false } },
                        imageQuestions: true,
                    }
                },
                ctestQuestions: {
                    where: { isSubjective: false }
                },
                imageQuestions: true
            }
        });

        if (!testData) return res.status(404).json({ success: false, error: 'Test not found' });

        // Build question -> subject mapping
        const questionSubjectMap = new Map<number, number>(); // questionId -> subjectId
        const mcqCorrectResponseMap = new Map<number, number>(); // mcqId -> correctResponse
        const imgMaxMarksMap = new Map<number, number>(); // imgQId -> maxMarks

        testData.sections.forEach(section => {
            section.mcqQuestions.forEach(q => {
                questionSubjectMap.set(q.id, section.subjectId);
                mcqCorrectResponseMap.set(q.id, q.correctResponse);
            });
            section.imageQuestions.forEach(q => {
                questionSubjectMap.set(q.id, section.subjectId);
                imgMaxMarksMap.set(q.id, q.maxMarks || 0);
            });
        });

        // Legacy questions (no section, always visible)
        testData.ctestQuestions.forEach(q => {
            mcqCorrectResponseMap.set(q.id, q.correctResponse);
            questionSubjectMap.set(q.id, -1); // -1 means "legacy, always accessible"
        });
        testData.imageQuestions.forEach(q => {
            imgMaxMarksMap.set(q.id, q.maxMarks || 0);
            questionSubjectMap.set(q.id, -1);
        });

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
                submittedAt: 'asc',
            },
        });

        if (submissions.length === 0) {
            return res.json({
                success: true,
                submissions: [],
                count: 0,
            });
        }

        // Batch fetch student subscriptions
        const studentIds = [...new Set(submissions.map(s => s.endUsersId))];
        const subscriptions = await prisma.mgSubsciption.findMany({
            where: {
                endUsersId: { in: studentIds },
                bigCourseId: Number(bigCourseId),
                isActive: true
            },
            include: {
                bigCourseBundle: true
            }
        });

        // Build student -> authorized subjects map
        const studentSubjectMap = new Map<number, number[] | "ALL">();
        subscriptions.forEach(sub => {
            if (sub.bigCourseBundle && sub.bigCourseBundle.subjectIds.length > 0) {
                studentSubjectMap.set(sub.endUsersId, sub.bigCourseBundle.subjectIds);
            } else if (sub.isFullCourse) {
                studentSubjectMap.set(sub.endUsersId, "ALL");
            }
        });

        // Deduplicate & calculate per-student scores
        const uniqueMap = new Map<number, any>();

        for (const sub of submissions) {
            if (!uniqueMap.has(sub.endUsersId)) {
                const authorizedSubjects = studentSubjectMap.get(sub.endUsersId);

                let dynamicTotalMarks = 0;
                let dynamicAwardedMarks = 0;

                // Helper: Check if question is authorized for this student
                const isAuthorized = (questionId: number): boolean => {
                    const subjectId = questionSubjectMap.get(questionId);
                    if (subjectId === undefined) return false; // Unknown question
                    if (subjectId === -1) return true; // Legacy question, always accessible
                    if (!authorizedSubjects) return false; // No subscription
                    if (authorizedSubjects === "ALL") return true; // Full course access
                    return authorizedSubjects.includes(subjectId); // Bundle check
                };

                // Calculate MCQ scores
                sub.cTestResponse.forEach(resp => {
                    if (isAuthorized(resp.ctestQuestionsId)) {
                        dynamicTotalMarks += 1;
                        const correctResponse = mcqCorrectResponseMap.get(resp.ctestQuestionsId);
                        if (correctResponse !== undefined && resp.response === correctResponse) {
                            dynamicAwardedMarks += 1;
                        }
                    }
                });

                // Calculate Image question scores
                sub.imageAnswers.forEach(ans => {
                    if (isAuthorized(ans.questionId)) {
                        const maxMarks = imgMaxMarksMap.get(ans.questionId) || 0;
                        dynamicTotalMarks += maxMarks;
                        if (ans.awardedMarks !== null) {
                            dynamicAwardedMarks += ans.awardedMarks;
                        }
                    }
                });

                uniqueMap.set(sub.endUsersId, {
                    ...sub,
                    totalMarks: dynamicTotalMarks,
                    maxMark: dynamicTotalMarks,
                    maxMarks: dynamicTotalMarks,
                    awardedMarks: dynamicAwardedMarks,
                    score: `${dynamicAwardedMarks}/${dynamicTotalMarks}`
                });
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
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}


export async function GetMyBigCourseCtestSubmission(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body;

    if (!endUsersId || !bigCourseId || endUsersId == 0 || bigCourseId == 0) {
        res.status(400).json({ success: false, error: 'endUsersId and ctestId are required', bigCourseId, endUsersId });
        return;
    }

    try {
        const subjectFilter = await getUserSubjectFilter(req.user || endUsersId, req.role || 'user', Number(bigCourseId));
        const ctestIds = (await prisma.ctest.findMany({
            where: {
                bigCourseId: Number(bigCourseId),
                ...subjectFilter,
            },
            select: { id: true }
        })).map(e => e.id)
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

        // Check if submission has been finalized (has gradedAt timestamp)
        if (submission.gradedAt) {
            return res.status(400).json({ error: 'Cannot modify marks for a finalized submission' });
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
                        ctestQuestions: { where: { isSubjective: false } },
                        sections: {
                            include: {
                                mcqQuestions: { where: { isSubjective: false } },
                                imageQuestions: true,
                            }
                        }
                    },
                },
                imageAnswers: {
                    include: {
                        question: true,
                    },
                },
                cTestResponse: true,
            },
        });

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        if (submission.ctest.mode !== CTestMode.IMAGE && submission.ctest.mode !== CTestMode.COMBINED) {
            return res.status(400).json({ error: 'This submission must be an IMAGE or COMBINED mode CTest' });
        }

        if (submission.status !== CTestSubmissionStatus.SUBMITTED) {
            return res.status(400).json({ error: 'Submission has already been finalized' });
        }

        // Check if all IMAGE questions have been marked
        const allImageQuestions = submission.ctest.imageQuestions;
        const answeredImageQuestions = submission.imageAnswers;

        // Check if all image questions have awardedMarks
        const unmarkedAnswers = answeredImageQuestions.filter(a => a.awardedMarks === null);
        if (unmarkedAnswers.length > 0) {
            return res.status(400).json({
                error: `Cannot finalize: ${unmarkedAnswers.length} image question(s) are not yet marked`,
                unmarkedQuestionIds: unmarkedAnswers.map(a => a.questionId),
            });
        }

        // Calculate total awarded marks for IMAGE questions
        let totalAwarded = answeredImageQuestions.reduce(
            (sum, answer) => sum + (answer.awardedMarks || 0),
            0
        );

        // Calculate total possible marks for IMAGE questions
        let totalPossible = allImageQuestions.reduce(
            (sum, question) => sum + question.maxMarks,
            0
        );

        // For COMBINED tests, include MCQ marks
        if (submission.ctest.mode === CTestMode.COMBINED) {
            // Build MCQ correct response map
            const mcqCorrectResponseMap = new Map<number, number>();

            // From sections
            submission.ctest.sections.forEach(section => {
                section.mcqQuestions.forEach(q => {
                    mcqCorrectResponseMap.set(q.id, q.correctResponse);
                });
            });

            // From legacy questions
            submission.ctest.ctestQuestions.forEach(q => {
                mcqCorrectResponseMap.set(q.id, q.correctResponse);
            });

            // Calculate MCQ scores (1 mark per question)
            let mcqAwarded = 0;
            let mcqPossible = 0;

            submission.cTestResponse.forEach(resp => {
                const correctResponse = mcqCorrectResponseMap.get(resp.ctestQuestionsId);
                if (correctResponse !== undefined) {
                    mcqPossible += 1;
                    if (resp.response === correctResponse) {
                        mcqAwarded += 1;
                    }
                }
            });

            totalAwarded += mcqAwarded;
            totalPossible += mcqPossible;
        }

        // Calculate percentage
        const percentage = totalPossible > 0 ? (totalAwarded / totalPossible) * 100 : 0;

        // Calculate percentage-based reward (10% = 1 coin, so 60% = 6 coins)
        const percentageCoins = Math.floor(percentage / 10);

        // Update submission with final marks (keep status as SUBMITTED)
        const updatedSubmission = await prisma.ctestSubmission.update({
            where: { id: submissionId },
            data: {
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

        await invalidateCache('ctest:view:*');

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

    const subjectFilter = await getUserSubjectFilter(req.user || userId, req.role || 'user', Number(courseId));
    const isFilterEmpty = Object.keys(subjectFilter).length === 0;

    try {
        const whereClause: any = {
            bigCourseId: Number(courseId),
        };

        if (!isFilterEmpty) {
            whereClause.OR = [
                subjectFilter,
                {
                    sections: {
                        some: subjectFilter
                    }
                }
            ];
        }

        const [tests, total] = await Promise.all([
            prisma.ctest.findMany({
                where: whereClause,
                select: {
                    id: true,
                    title: true,
                    startDate: true,
                    endDate: true,
                    Duration: true,
                    mode: true,
                    totalMarks: true,
                    subject: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    sections: {
                        where: subjectFilter,
                        select: {
                            id: true,
                            duration: true,
                            subjectId: true,
                            subject: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                            mcqQuestions: {
                                where: { isSubjective: false },
                                select: { id: true }
                            },
                            imageQuestions: {
                                select: { maxMarks: true }
                            }
                        }
                    },
                    ctestQuestions: {
                        where: { isSubjective: false, test: subjectFilter },
                        select: { id: true }
                    },
                    imageQuestions: {
                        where: { test: subjectFilter },
                        select: { maxMarks: true }
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
                where: whereClause,
            }),
        ]);

        const formattedTests = tests.map((test) => {
            let duration = test.Duration || 0;
            let totalMarks = test.totalMarks || 0;

            // If it's a multi-subject test, calculate duration and marks based on authorized sections
            if (test.sections && test.sections.length > 0) {
                duration = 0;
                totalMarks = 0;
                test.sections.forEach(s => {
                    duration += (s.duration || 0);
                    totalMarks += s.mcqQuestions.length;
                    s.imageQuestions.forEach(iq => {
                        totalMarks += (iq.maxMarks || 0);
                    });
                });
            } else {
                // Legacy compatibility: Calculate marks dynamically for non-sectioned tests
                totalMarks = (test as any).ctestQuestions.length;
                (test as any).imageQuestions.forEach((iq: any) => {
                    totalMarks += (iq.maxMarks || 0);
                });
            }

            // User requested dynamic end time: startDate + duration
            let calculatedEndTime = test.endDate;
            if (test.startDate && duration > 0) {
                const start = new Date(test.startDate);
                calculatedEndTime = new Date(start.getTime() + duration * 60000);
            }

            // Determine the display subject. 
            let displaySubject = (test.sections && test.sections.length > 0) ? test.sections[0].subject : test.subject;

            const sf = subjectFilter as any;
            if (displaySubject && sf.subjectId) {
                if (sf.subjectId.in) {
                    if (!sf.subjectId.in.includes(displaySubject.id)) displaySubject = null;
                } else if (typeof sf.subjectId === 'number') {
                    if (sf.subjectId !== displaySubject.id) displaySubject = null;
                }
            }

            // Get Unique Allowed Subjects
            const uniqueSubjectsMap = new Map();
            test.sections.forEach(s => {
                if (s.subject) uniqueSubjectsMap.set(s.subject.id, s.subject);
            });
            const allowedSubjectsList = Array.from(uniqueSubjectsMap.values());

            // If it is a legacy test and has no sections, populate allowedSubjects with its main subject
            if (allowedSubjectsList.length === 0 && displaySubject) {
                allowedSubjectsList.push(displaySubject);
            }

            return {
                ctestId: test.id,
                title: test.title,
                startDate: test.startDate,
                endDate: calculatedEndTime,
                duration: duration,
                mode: test.mode,
                totalMarks: totalMarks,
                subject: displaySubject,
                allowedSubjects: allowedSubjectsList,
                attemptStatus:
                    test.ctestSubmission.length > 0
                        ? test.ctestSubmission[0].status
                        : "NOT_ATTEMPTED",
            };
        });

        const pagination = {
            page: Number(page),
            limit: LIMIT,
            hasNext: offset + LIMIT < total,
        };

        return res.json({
            success: true,
            tests: formattedTests,
            pagination,
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

        const ctestBase = await prisma.ctest.findUnique({
            where: { id: Number(courseTestId) },
            select: { bigCourseId: true }
        });

        if (!ctestBase) {
            return res.status(404).json({ success: false, error: "Test not found" });
        }

        const subjectFilter = await getUserSubjectFilter(req.user || userId, req.role || 'user', ctestBase.bigCourseId);

        const test = await prisma.ctest.findUnique({
            where: { id: Number(courseTestId) },
            select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
                Duration: true,
                totalMarks: true,
                mode: true,
                subject: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                sections: {
                    where: subjectFilter,
                    include: {
                        subject: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        mcqQuestions: {
                            where: { isSubjective: false },
                            select: {
                                id: true,
                                question: true,
                                option1: true,
                                option2: true,
                                option3: true,
                                option4: true,
                            },
                        },
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
                            orderBy: { sortOrder: "asc" },
                        }
                    },
                    orderBy: { sortOrder: "asc" }
                },

                /* Legacy support for direct questions if they have subjectId (only if no sections exist) */
                ctestQuestions: {
                    where: {
                        isSubjective: false,
                        test: subjectFilter
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
                imageQuestions: {
                    where: { test: subjectFilter },
                    select: {
                        id: true,
                        prompt: true,
                        instructions: true,
                        questionImages: true,
                        maxMarks: true,
                        maxAnswerImages: true,
                        sortOrder: true,
                    },
                    orderBy: { sortOrder: "asc" },
                },
            },
        });

        if (!test) {
            return res.status(404).json({
                success: false,
                error: "Course test not found",
            });
        }

        let totalDuration = 0;
        let totalMarks = 0;

        const sectionsPayload = test.sections.map(s => {
            totalDuration += s.duration || 0;

            const unifiedQuestions = [
                ...s.mcqQuestions.map(q => {
                    totalMarks += 1;
                    return {
                        id: q.id,
                        type: "MCQ",
                        question: q.question,
                        options: [q.option1, q.option2, q.option3, q.option4].filter(Boolean),
                    };
                }),
                ...s.imageQuestions.map(q => {
                    totalMarks += (q.maxMarks || 0);
                    return {
                        id: q.id,
                        type: "IMAGE",
                        prompt: q.prompt,
                        instructions: q.instructions,
                        images: q.questionImages,
                        maxMarks: q.maxMarks,
                        maxAnswerImages: q.maxAnswerImages,
                        sortOrder: q.sortOrder,
                    };
                })
            ];

            return {
                id: s.id,
                title: s.title,
                duration: s.duration,
                subjectId: s.subjectId,
                subject: s.subject,
                questions: unifiedQuestions,
                totalQuestions: unifiedQuestions.length
            };
        });

        // Add legacy/non-sectioned questions as a "General" section if they exist
        if (test.sections.length === 0 && (test.ctestQuestions.length > 0 || test.imageQuestions.length > 0)) {
            totalDuration = test.Duration || 0;
            totalMarks = 0; // Reset to calculate for legacy questions

            const unifiedQuestions = [
                ...test.ctestQuestions.map(q => {
                    totalMarks += 1; // MCQ always 1 mark
                    return {
                        id: q.id,
                        type: "MCQ",
                        question: q.question,
                        options: [q.option1, q.option2, q.option3, q.option4].filter(Boolean),
                    };
                }),
                ...test.imageQuestions.map(q => {
                    totalMarks += (q.maxMarks || 0);
                    return {
                        id: q.id,
                        type: "IMAGE",
                        prompt: q.prompt,
                        instructions: q.instructions,
                        images: q.questionImages,
                        maxMarks: q.maxMarks,
                        maxAnswerImages: q.maxAnswerImages,
                        sortOrder: q.sortOrder,
                    };
                })
            ];

            sectionsPayload.push({
                id: 0,
                title: "General",
                duration: test.Duration || 0,
                subjectId: test.subject?.id || 0,
                subject: test.subject || { id: 0, name: "General" },
                questions: unifiedQuestions,
                totalQuestions: unifiedQuestions.length
            });
        }


        if (sectionsPayload.length === 0) {
            return res.status(403).json({
                success: false,
                error: "You are not authorized to access any sections of this test.",
            });
        }

        // Calculate personalized end time
        let calculatedEndTime = test.endDate;
        if (test.startDate && totalDuration > 0) {
            const start = new Date(test.startDate);
            calculatedEndTime = new Date(start.getTime() + totalDuration * 60000);
        }

        // Determine display subject
        let displaySubject = (test.sections && test.sections.length > 0) ? test.sections[0].subject : test.subject;
        const sf = subjectFilter as any;
        if (displaySubject && sf.subjectId) {
            if (sf.subjectId.in) {
                if (!sf.subjectId.in.includes(displaySubject.id)) displaySubject = null;
            } else if (typeof sf.subjectId === 'number') {
                if (sf.subjectId !== displaySubject.id) displaySubject = null;
            }
        }

        const payload = {
            test: {
                id: test.id,
                title: test.title,
                startDate: test.startDate,
                endDate: calculatedEndTime,
                duration: totalDuration,
                totalMarks: totalMarks || test.totalMarks,
                mode: test.mode,
                subject: displaySubject,
            },
            sections: sectionsPayload
        };

        return res.json({
            success: true,
            data: payload,
        });
    } catch (error) {
        console.error("GetCourseTestQuestions error:", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
        });
    }
}

export async function GetCourseTestQuestionsForTeacher(
    req: Request,
    res: Response
) {
    const { courseTestId } = req.body;

    if (!courseTestId) {
        return res.status(400).json({
            success: false,
            error: "courseTestId is required",
        });
    }

    try {
        const test = await prisma.ctest.findUnique({
            where: { id: Number(courseTestId) },
            select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
                Duration: true,
                totalMarks: true,
                mode: true,
                subject: {
                    select: { id: true, name: true },
                },
                sections: {
                    include: {
                        subject: { select: { id: true, name: true } },
                        mcqQuestions: {
                            orderBy: { id: "asc" }
                        },
                        imageQuestions: {
                            orderBy: { sortOrder: "asc" },
                        }
                    },
                    orderBy: { sortOrder: "asc" }
                },
                ctestQuestions: true,
                imageQuestions: {
                    orderBy: { sortOrder: "asc" },
                },
            },
        });

        if (!test) {
            return res.status(404).json({ success: false, error: "Course test not found" });
        }

        let totalDuration = 0;
        let totalMarks = 0;

        const sectionsPayload = test.sections.map(s => {
            totalDuration += s.duration || 0;

            const unifiedQuestions = [
                ...s.mcqQuestions.map(q => {
                    totalMarks += 1;
                    return {
                        id: q.id,
                        type: "MCQ",
                        question: q.question,
                        options: [q.option1, q.option2, q.option3, q.option4].filter(Boolean),
                        correctResponse: q.correctResponse,
                        isSubjective: q.isSubjective,
                        maxWords: q.maxWords,
                        allowAttachments: q.allowAttachments
                    };
                }),
                ...s.imageQuestions.map(q => {
                    totalMarks += (q.maxMarks || 0);
                    return {
                        id: q.id,
                        type: "IMAGE",
                        prompt: q.prompt,
                        instructions: q.instructions,
                        images: q.questionImages,
                        maxMarks: q.maxMarks,
                        maxAnswerImages: q.maxAnswerImages,
                        sortOrder: q.sortOrder,
                    };
                })
            ];

            return {
                id: s.id,
                title: s.title,
                duration: s.duration,
                subject: s.subject,
                questions: unifiedQuestions,
                totalQuestions: unifiedQuestions.length
            };
        });

        // Legacy compatibility
        if (test.sections.length === 0 && (test.ctestQuestions.length > 0 || test.imageQuestions.length > 0)) {
            totalDuration = test.Duration || 0;
            totalMarks = 0; // Reset for legacy

            const unifiedQuestions = [
                ...test.ctestQuestions.map(q => {
                    totalMarks += 1; // MCQ
                    return {
                        id: q.id,
                        type: "MCQ",
                        question: q.question,
                        options: [q.option1, q.option2, q.option3, q.option4].filter(Boolean),
                        correctResponse: q.correctResponse,
                        isSubjective: q.isSubjective,
                        maxWords: q.maxWords,
                        allowAttachments: q.allowAttachments
                    };
                }),
                ...test.imageQuestions.map(q => {
                    totalMarks += (q.maxMarks || 0);
                    return {
                        id: q.id,
                        type: "IMAGE",
                        prompt: q.prompt,
                        instructions: q.instructions,
                        images: q.questionImages,
                        maxMarks: q.maxMarks,
                        maxAnswerImages: q.maxAnswerImages,
                        sortOrder: q.sortOrder,
                    };
                })
            ];

            sectionsPayload.push({
                id: 0,
                title: "General",
                duration: test.Duration || 0,
                subject: test.subject || { id: 0, name: "General" },
                questions: unifiedQuestions,
                totalQuestions: unifiedQuestions.length
            });
        }

        const payload = {
            test: {
                id: test.id,
                title: test.title,
                startDate: test.startDate,
                endDate: test.endDate,
                duration: totalDuration || test.Duration,
                totalMarks: totalMarks || test.totalMarks,
                mode: test.mode,
                subject: test.subject,
            },
            sections: sectionsPayload
        };

        return res.json({
            success: true,
            data: payload,
        });
    } catch (error) {
        console.error("GetCourseTestQuestionsForTeacher error:", error);
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
}

export async function getCourseTestList(req: Request, res: Response) {
    const { courseId } = req.body;

    // Validation
    if (!courseId || isNaN(Number(courseId))) {
        return res.status(400).json({
            success: false,
            error: "Valid courseId is required"
        });
    }

    try {
        const userId = (req as any).user?.id || (req as any).user?.user;
        const subjectFilter = await getUserSubjectFilter(req.user || userId, req.role || 'user', Number(courseId));
        const isFilterEmpty = Object.keys(subjectFilter).length === 0;

        const whereClause: any = {
            bigCourseId: Number(courseId),
        };

        if (!isFilterEmpty) {
            whereClause.OR = [
                subjectFilter,
                {
                    sections: {
                        some: subjectFilter
                    }
                }
            ];
        }

        const tests = await prisma.ctest.findMany({
            where: whereClause,
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
                        name: true
                    }
                },
                sections: {
                    where: subjectFilter,
                    select: {
                        id: true,
                        subject: { select: { id: true, name: true } }
                    }
                },
                ctestQuestions: {
                    where: { isSubjective: false, test: subjectFilter },
                    select: { id: true }
                },
                imageQuestions: {
                    where: { test: subjectFilter },
                    select: { maxMarks: true }
                }
            },
            orderBy: {
                startDate: "desc"
            }
        });

        const formatted = tests.map(test => {
            let displaySubject = (test.sections && test.sections.length > 0) ? test.sections[0].subject : test.subject;
            const sf = subjectFilter as any;
            if (displaySubject && sf.subjectId) {
                if (sf.subjectId.in) {
                    if (!sf.subjectId.in.includes(displaySubject.id)) displaySubject = null;
                } else if (typeof sf.subjectId === 'number') {
                    if (sf.subjectId !== displaySubject.id) displaySubject = null;
                }
            }
            let totalMarks = test.totalMarks || 0;
            if (test.sections && test.sections.length === 0) {
                totalMarks = (test as any).ctestQuestions.length;
                (test as any).imageQuestions.forEach((iq: any) => {
                    totalMarks += (iq.maxMarks || 0);
                });
            }

            return {
                ...test,
                totalMarks,
                subject: displaySubject,
                sections: undefined as any
            };
        });

        return res.status(200).json({
            success: true,
            totalTests: formatted.length,
            data: formatted
        });

    } catch (error) {

        console.error("getCourseTestList error:", error);

        return res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
}

export async function createUnifiedCtestSubmission(req: Request, res: Response) {
    try {
        const { ctestId, endUsersId, mcqResponses, imageAnswers } = req.body as UnifiedCtestSubmissionPayload;

        if (!ctestId || !endUsersId) {
            return res.status(400).json({ error: 'Missing ctestId or endUsersId' });
        }

        const existing = await prisma.ctestSubmission.findFirst({
            where: { ctestId, endUsersId, status: CTestSubmissionStatus.SUBMITTED }
        });

        if (existing) {
            return res.status(400).json({ error: 'Test already submitted' });
        }

        const ctestBase = await prisma.ctest.findUnique({
            where: { id: Number(ctestId) },
            select: { bigCourseId: true, title: true }
        });

        if (!ctestBase) {
            return res.status(404).json({ error: 'Test not found' });
        }

        const subjectFilter = await getUserSubjectFilter(req.user || endUsersId, req.role || 'user', ctestBase.bigCourseId);

        const test = await prisma.ctest.findUnique({
            where: { id: Number(ctestId) },
            include: {
                sections: {
                    where: subjectFilter,
                    include: {
                        mcqQuestions: true,
                        imageQuestions: true
                    }
                },
                ctestQuestions: {
                    where: { isSubjective: false, test: subjectFilter }
                },
                imageQuestions: {
                    where: { test: subjectFilter }
                }
            }
        });

        if (!test) return res.status(404).json({ error: 'Authorized test content not found' });

        const result = await prisma.$transaction(async (tx) => {
            const submission = await tx.ctestSubmission.create({
                data: {
                    ctestId: Number(ctestId),
                    endUsersId: Number(endUsersId),
                    status: CTestSubmissionStatus.SUBMITTED,
                    submittedAt: new Date(),
                }
            });

            let correctAnswers = 0;
            let totalMcqs = 0;
            const authorizedMcqIds = new Set<number>();
            const mcqAnswerKey = new Map<number, number>();

            test.sections.forEach(s => s.mcqQuestions.forEach(q => {
                authorizedMcqIds.add(q.id);
                mcqAnswerKey.set(q.id, q.correctResponse);
            }));

            // Legacy questions check subjectFilter manually if needed, 
            // but for sections-based tests they should be in sections.
            // If they are legacy test questions, check them too.
            test.ctestQuestions.forEach(q => {
                authorizedMcqIds.add(q.id);
                mcqAnswerKey.set(q.id, (q as any).correctResponse);
            });

            if (mcqResponses && mcqResponses.length > 0) {
                for (const resp of mcqResponses) {
                    if (authorizedMcqIds.has(resp.ctestQuestionsId)) {
                        await tx.cTestResponse.create({
                            data: {
                                response: resp.response,
                                endUsersId: Number(endUsersId),
                                ctestQuestionsId: resp.ctestQuestionsId,
                                ctestId: Number(ctestId),
                                ctestSubmissionId: submission.id,
                            }
                        });
                        if (resp.response === mcqAnswerKey.get(resp.ctestQuestionsId)) {
                            correctAnswers++;
                        }
                        totalMcqs++;
                    }
                }
            }

            const authorizedImageQIds = new Set<number>();
            test.sections.forEach(s => s.imageQuestions.forEach(q => authorizedImageQIds.add(q.id)));
            test.imageQuestions.forEach(q => authorizedImageQIds.add(q.id));

            if (imageAnswers && imageAnswers.length > 0) {
                for (const ans of imageAnswers) {
                    if (authorizedImageQIds.has(ans.questionId)) {
                        await tx.ctestImageAnswer.create({
                            data: {
                                submissionId: submission.id,
                                questionId: ans.questionId,
                                answerImages: ans.answerImages,
                                notes: ans.notes ?? null,
                            }
                        });
                    }
                }
            }

            // Calculate dynamic total marks for authorized content
            let dynamicTotalMarks = 0;
            test.sections.forEach(s => {
                dynamicTotalMarks += s.mcqQuestions.length;
                s.imageQuestions.forEach(iq => {
                    dynamicTotalMarks += (iq.maxMarks || 0);
                });
            });
            // Legacy questions marks
            if (test.sections.length === 0) {
                dynamicTotalMarks += test.ctestQuestions.length;
                test.imageQuestions.forEach(iq => {
                    dynamicTotalMarks += (iq.maxMarks || 0);
                });
            }

            await tx.ctestSubmission.update({
                where: { id: submission.id },
                data: {
                    awardedMarks: correctAnswers,
                    totalMarks: dynamicTotalMarks, // Always use dynamic
                }
            });

            return { submissionId: submission.id, correctAnswers, dynamicTotalMarks };
        });

        res.status(201).json({ success: true, submissionId: result.submissionId, score: `${result.correctAnswers}/${result.dynamicTotalMarks}` });

    } catch (error) {
        console.error('Error in createUnifiedCtestSubmission:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}
