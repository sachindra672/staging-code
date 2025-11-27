import { Request, Response } from "express"
import { prisma } from "../misc"

interface SessionTestResponseInput {
    response: number;
    sessionTestQuestionId: number;
    sessionTestSubmissionId: number;
    sessionTestId: number;
    endUsersId: number;
}

function isValidSessionTestResponseInput(obj: any): obj is SessionTestResponseInput {
    return (
        typeof obj.response === 'number' &&
        typeof obj.sessionTestSubmissionId === 'number' &&
        typeof obj.sessionTestQuestionId === 'number' &&
        typeof obj.sessionTestId === 'number' &&
        typeof obj.endUsersId === 'number'
    );
}

export async function createSessionTestSubmission(req: Request, res: Response): Promise<void> {
    const { sessionTestId, endUsersId, responses } = req.body;

    try {
        const newSubmission = await prisma.sessionTestSubmission.create({
            data: {
                sessionTestId: sessionTestId,
                endUsersId: endUsersId,
                sessionTestResponse: {
                    create: responses.map(function (response: any) {
                        return {
                            forQuestion: {
                                connect: { id: response.sessionTestQuestionId }
                            },
                            response: response.response,
                            forTest: {
                                connect: { id: sessionTestId }
                            },
                            createdBy: {
                                connect: { id: endUsersId }
                            }
                        };
                    })
                }
            },
            include: {
                sessionTestResponse: true
            }
        });

        res.status(201).json(newSubmission);
    } catch (error) {
        console.error('Error creating sessionTestSubmission with responses:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function SubmitSessionTestResponses(req: Request, res: Response) {
    try {
        const responses = Array.isArray(req.body) ? req.body : [];

        // Filter valid responses
        const validResponses = responses.filter(isValidSessionTestResponseInput);

        if (validResponses.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid responses provided' });
        }

        const resp = await prisma.sessionTestResponse.createMany({
            data: validResponses
        });

        res.json({ success: true, resp });
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, error: error });
    }
}

export async function GetSessionTestSubmissions(req: Request, res: Response) {
    const { endUsersId, sessionTestId } = req.body

    try {
        const responses = await prisma.sessionTestResponse.findMany({ where: { sessionTestId, endUsersId } })
        res.json({ success: true, responseCount: responses.length })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

export async function SubmitCourseTestResponse(req: Request, res: Response) {
    const { ctestQuestionsId, ctestId, endUsersId, response, ctestSubmissionId } = req.body

    try {
        const rx = await prisma.cTestResponse.create({ data: { ctestId, ctestQuestionsId, endUsersId, response, ctestSubmissionId } })
        res.json({ success: true, response: rx })
    } catch (error) {
        res.status(500).send({ success: false, error })
    }
}

export async function getCourseTestResponses(req: Request, res: Response) {
    const { endUsersId, ctestId } = req.body

    try {
        const responses = await prisma.cTestResponse.findMany({ where: { endUsersId, ctestId } })
        res.json({ success: true, responses })
    } catch (error) {
        res.status(500).send({ success: false, error })
    }
}


export async function getMyBgCourseSubscriptions(req: Request, res: Response) {
    const { endUsersId } = req.body

    try {
        const sub = await prisma.mgSubsciption.findMany({ where: { endUsersId } })
        res.json({ success: true, sub })
    } catch (error) {
        res.status(500).send({ success: false, error })
    }
}