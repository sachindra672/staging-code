import { Request, Response } from "express";
import { prisma } from "./misc";
import fs from 'fs';
import path from 'path';
import { sendMail } from "./utils/mail";

export async function insertDoubt(req: Request, res: Response) {
    const { subject, description, topic, userId, subjectRecord, files, mentorId, conversationId } = req.body;


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
                conversationId,
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

                //@ts-ignore
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

function doubtCreatedEmailTemplate(teacherName: string, subject: string, topic: string, description: string, doubtId: number) {
    return `
    <div style="font-family: Arial, sans-serif; background:#f5f7fa; padding:20px;">
        <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
            
            <div style="background:#1a73e8; padding:20px; text-align:center;">
                <img src="https://storage.googleapis.com/sisya-class-52660.appspot.com/globalMaterialUpload/12/Logo/-QAybKnHXpRnTHfDmm5vK-1764075707714.png" 
                     alt="Sisya Logo" style="height:60px; border-radius:10px;">
            </div>

            <div style="padding:25px;">
                <h2 style="color:#1a1a1a;">New Doubt Assigned</h2>

                <p style="font-size:15px; color:#333;">
                    Hello <strong>${teacherName || "Teacher"}</strong>,
                </p>

                <p style="font-size:15px; color:#333;">
                    A new student doubt has been assigned to you on the SISYA platform.
                </p>

                <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin-top:15px;">
                    <p style="margin:0; font-size:14px;"><strong>Subject:</strong> ${subject}</p>
                    <p style="margin:0; font-size:14px;"><strong>Topic:</strong> ${topic}</p>
                    <p style="margin:0; font-size:14px;"><strong>Description:</strong> ${description}</p>
                    <p style="margin:0; font-size:14px;"><strong>Doubt ID:</strong> ${doubtId}</p>
                </div>

                <div style="text-align:center; margin-top:25px;">
                    <a href="https://teacher.sisya.in/doubt/${doubtId}"
                       style="background:#1a73e8; color:white; padding:12px 22px; border-radius:6px; text-decoration:none; font-size:15px;">
                        View Doubt
                    </a>
                </div>

                <p style="margin-top:25px; font-size:13px; color:#777;">
                    Please log in to your SISYA teacher doubt dashboard to respond to the student.
                </p>
            </div>

            <div style="text-align:center; background:#f1f1f1; padding:15px; font-size:12px; color:#666;">
                © ${new Date().getFullYear()} SISYA Learning. All rights reserved.
            </div>

        </div>
    </div>`;
}

export async function insertDoubt2(req: Request, res: Response) {
    const { subject, description, topic, userId, subjectRecord, files, mentorId, conversationId } = req.body;

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
                conversationId,
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

                //@ts-ignore
                fs.writeFileSync(filePath, fileContent);
            });
        }

        const teacherList = (await prisma.subjectRecord.findMany({
            where: { id: subjectRecord.subjectId, mentorId: { not: null } },
            include: { mentor: true }
        })).map(e => e.mentor);


        if (teacherList.length > 0) {
            for (const teacher of teacherList) {
                if (teacher.email) {
                    const html = doubtCreatedEmailTemplate(
                        teacher.name,
                        subject,
                        topic,
                        description,
                        doubt.id
                    );

                    await sendMail(
                        teacher.email,
                        `New Student Doubt Assigned - ${subject}`,
                        html
                    );
                }
            }
        }

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
