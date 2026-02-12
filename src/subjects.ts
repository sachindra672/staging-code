import { Request, Response } from 'express'
import { prisma, areValidStrings } from "./misc"
import { randomUUID } from 'crypto'


export async function InsertBoard(req: Request, res: Response) {
    const { name, country } = req.body

    if (!areValidStrings(name, country)) {
        res.status(400).send("missing name or country information")
        return
    }
    try {
        const newBoard = await prisma.educationBoard.create({ data: { name, country } })
        res.json({ sucess: true, data: newBoard })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, error })
    }
}

export async function UpdateBoard(req: Request, res: Response) {
    const { educationBoardId, name, country, isActive } = req.body

    if (!areValidStrings(name, country)) {
        res.status(400).send("missing name or country information")
        return
    }
    try {
        const newBoard = await prisma.educationBoard.update({ where: { id: educationBoardId }, data: { name, country, updatedAt: new Date(), isActive } })
        res.json({ sucess: true, data: newBoard })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, error })
    }
}

export async function InsertSubject(req: Request, res: Response) {
    const { name, description, educationBoardId, gradeLevel } = req.body;

    if (!areValidStrings(name) || typeof educationBoardId !== 'number') {
        res.status(400).send("missing or invalid subject information");
        return;
    }

    try {
        const code = randomUUID()
        const newSubject = await prisma.subject.create({
            data: {
                name,
                description,
                code,
                educationBoardId,
                gradeLevel
            }
        });
        res.json({ success: true, data: newSubject });
    } catch (error) {
        console.error(error);  // Log the error for debugging
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}


export async function updateSubject(req: Request, res: Response) {
    const { name, description, educationBoardId, gradeLevel, subjectId, isActive } = req.body;

    if (!areValidStrings(name) || typeof educationBoardId !== 'number') {
        res.status(400).send("missing or invalid subject information");
        return;
    }

    try {
        const code = randomUUID()
        const newSubject = await prisma.subject.update({
            where: { id: subjectId },
            data: {
                name,
                description,
                code,
                educationBoardId,
                gradeLevel,
            }
        });
        res.json({ success: true, data: newSubject });
    } catch (error) {
        console.error(error);  // Log the error for debugging
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}

export async function InsertChapter(req: Request, res: Response) {
    const { number, title, description, subjectId, learningObjectives, estimatedDuration } = req.body;

    if (!areValidStrings(title) || typeof subjectId !== 'number' || typeof number !== 'number') {
        res.status(400).send("missing or invalid chapter information");
        return;
    }

    try {
        const newChapter = await prisma.chapter.create({
            data: {
                number,
                title,
                description,
                subjectId,
                learningObjectives,
                estimatedDuration
            }
        });
        res.json({ success: true, data: newChapter });
    } catch (error) {
        console.error(error);  // Log the error for debugging
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
}

export async function GetSubjectByGrade(req: Request, res: Response) {
    const { grade } = req.body

    if (!grade) {
        return res.json({ success: false, error: "invalid grade value" })
    }

    try {
        const subjects = await prisma.subject.findMany({ where: { gradeLevel: grade } })
        res.json({ success: true, subjects })
    } catch (error) {
        res.json({ success: false, error })
    }
}

export async function GetSubjectById(req: Request, res: Response) {
    const { id } = req.body

    if (!id) {
        return res.json({ success: false, error: "invalid grade value" })
    }

    try {
        const subjects = await prisma.subject.findMany({ where: { id } })
        res.json({ success: true, subjects })
    } catch (error) {
        res.json({ success: false, error })
    }
}

export async function GetAllSubjectData(_: Request, res: Response) {
    try {
        const subjects = await prisma.subject.findMany({ include: { chapters: { include: { topics: true } } } })
        res.json({ success: true, subjects })
    } catch (error) {
        res.json({ success: false, error })
    }
}

export async function GetAllBoards(_: Request, res: Response) {
    try {
        const boards = await prisma.educationBoard.findMany()
        res.json({ success: true, boards })
    } catch (error) {
        res.json({ success: false, error })
    }
}

