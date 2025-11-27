import { Request, Response } from "express";
import { prisma } from "./misc";
import fs from 'fs';
import path from 'path';

export async function insertDoubt(req: Request, res: Response) {
    const { subject, description, topic, userId, subjectRecord, files, mentorId } = req.body;

    if (!subject || !description || !topic || !userId || !subjectRecord || !mentorId) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        const doubt = await prisma.doubt.create({
            data: {
                subject,
                userId,
                description,
                topic,
                mentorId,
                status: 0,
                subjectRecord: {
                    create: subjectRecord
                }
            }
        });

        const doubtDir = path.join(__dirname, `../doubts/${doubt.id}`);
        if (!fs.existsSync(doubtDir)) {
            fs.mkdirSync(doubtDir, { recursive: true });
        }

        if (files && Array.isArray(files)) {
            files.forEach((file) => {
                const { filename, content } = file;
                const filePath = path.join(doubtDir, filename);
                const fileContent = Buffer.from(content, 'base64');

                fs.writeFileSync(filePath, fileContent);
            });
        }

        const teacherList = (await prisma.subjectRecord.findMany({
            where: { id: subjectRecord.subjectId, mentorId: { not: null } },
            include: { mentor: true }
        })).map(e => e.mentor);

        res.status(201).json({ success: true, doubt, teacherList });
    } catch (error) {
        console.error('Error in insertDoubt:', error);
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

export async function AssignMentor(req: Request, res: Response) {
    const { mentorId, doubtId } = req.body

    try {
        const doubt = await prisma.doubt.update({ where: { id: doubtId }, data: { mentorId } })
        res.status(200).json({ success: true, doubt })
    } catch (error) {
        console.error('Error in insertDoubt:', error);
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

export async function updateDoubt(req: Request, res: Response) {
    const { id, subject, description, topic, userId, status } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: 'Missing doubt id' });
    }

    try {
        const doubt = await prisma.doubt.update({
            where: { id },
            data: { subject, userId, description, topic, status }
        });
        res.status(200).json({ success: true, doubt });
    } catch (error) {
        console.error('Error in updateDoubt:', error);
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

export async function insertDoubtResponse(req: Request, res: Response) {
    const { response, doubtId, mentorId } = req.body;

    if (!response || !doubtId || !mentorId) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        const doubtResponse = await prisma.doubtResponse.create({
            data: { response, doubtId, mentorId }
        });
        res.status(201).json({ success: true, doubtResponse });
    } catch (error) {
        console.error('Error in insertDoubtResponse:', error);
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

export async function updateDoubtResponse(req: Request, res: Response) {
    const { id, response } = req.body;

    if (!id || !response) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        const updatedResponse = await prisma.doubtResponse.update({
            where: { id },
            data: { response }
        });
        res.status(200).json({ success: true, updatedResponse });
    } catch (error) {
        console.error('Error in updateDoubtResponse:', error);
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

export async function getMyDoubts(req: Request, res: Response) {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    try {
        const doubts = await prisma.doubt.findMany({
            where: { userId },
            include: { doubtResponse: true }
        });
        res.status(200).json({ success: true, doubts });
    } catch (error) {
        console.error('Error in getMyDoubts:', error);
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

export async function getDoubtFiles(req: Request, res: Response) {
    const { doubtId } = req.body;

    if (!doubtId) {
        return res.status(400).json({ success: false, error: 'Missing doubtId parameter' });
    }
    try {
        const doubtDir = path.join(__dirname, `../doubts/${doubtId}`);

        if (!fs.existsSync(doubtDir)) {
            return res.status(404).json({ success: false, error: 'Doubt not found or no files uploaded' });
        }
        const files = fs.readdirSync(doubtDir);
        res.status(200).json({ success: true, files });
    } catch (error) {
        console.error('Error in getDoubtFiles:', error);
        res.status(500).json({ success: false, error: 'Internal server error', message: error });
    }
}

export async function getAssignedDoubts(req: Request, res: Response) {
    const { mentorId } = req.body
    if (!mentorId) {
        return res.status(400).json({ success: false, error: 'Missing doubtId parameter' });
    }
    try {
        const users = (await prisma.doubt.findMany({ where: { mentorId }, include: { asker: true } })).map(e => e.asker).map(e => { return { ...e, password: null } })
        res.status(200).json({ success: true, users });
    } catch (error) {
        console.error('Error in getDoubtFiles:', error);
        res.status(500).json({ success: false, error: 'Internal server error', message: error });
    }
}

export async function getAssignedDoubtsList(req: Request, res: Response) {
    const { mentorId } = req.body
    if (!mentorId) {
        return res.status(400).json({ success: false, error: 'Missing doubtId parameter' });
    }
    try {
        const doubts = (await prisma.doubt.findMany({ where: { mentorId }, include: { asker: true } }))
        res.status(200).json({ success: true, doubts });
    } catch (error) {
        console.error('Error in getDoubtFiles:', error);
        res.status(500).json({ success: false, error: 'Internal server error', message: error });
    }
}

export async function GetAllDoubts(_: Request, res: Response) {
    try {
        const doubts = await prisma.doubt.findMany()
        res.status(200).json({ success: true, doubts });

    } catch (error) {
        console.error('Error in getDoubtFiles:', error);
        res.status(500).json({ success: false, error: 'Internal server error', message: error });
    }
}
