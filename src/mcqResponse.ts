import { Request, Response } from 'express';
import { prisma } from './misc';

interface TestResponse {
    mcqId: number;
    response: number;
}

interface Result {
    mcqId: number;
    isCorrect: boolean;
    correctAnswer: number;
}

async function checkAnswers(responses: TestResponse[]): Promise<{ score: number, results: Result[] }> {
    const mcqIds = responses.map(response => response.mcqId);
    const mcqs = await prisma.mcq.findMany({
        where: { id: { in: mcqIds } },
        select: { id: true, answer: true }
    });

    const results: Result[] = [];
    let score = 0;

    for (const response of responses) {
        const mcq = mcqs.find(mcq => mcq.id === response.mcqId);
        if (mcq) {
            const isCorrect = mcq.answer === response.response;
            if (isCorrect) score++;
            results.push({
                mcqId: response.mcqId,
                isCorrect,
                correctAnswer: mcq.answer
            });
        }
    }

    return { score, results };
}


export async function InsertAndCheckMcqResponses(req: Request, res: Response) {
    const { responses } = req.body;

    if (!Array.isArray(responses) || responses.length === 0) {
        return res.status(400).json({ success: false, message: 'Responses array is required and cannot be empty' });
    }

    const missingFields = responses.map((response, index) => {
        const fields = [];
        if (!response.mcqId) fields.push('mcqId');
        if (!response.mcqTestId) fields.push('mcqTestId');
        if (!response.endUsersId) fields.push('endUsersId');
        if (response.response === undefined) fields.push('response');
        return fields.length > 0 ? { index, fields } : null;
    }).filter(item => item !== null);

    if (missingFields.length > 0) {
        return res.status(400).json({ success: false, missingFields });
    }

    try {
        const { score, results } = await checkAnswers(responses);
        const createdResponses = await prisma.mcqResponses.createMany({
            data: responses.map(response => ({
                mcqId: response.mcqId,
                mcqTestId: response.mcqTestId,
                endUsersId: response.endUsersId,
                response: response.response
            })),
            skipDuplicates: true
        });

        res.status(200).json({ success: true, score, results, count: createdResponses.count });
    } catch (error) {
        console.error('Error handling bulk insert of mcqResponses:', error);
        res.status(500).json({ success: false, cause: error });
    }
}