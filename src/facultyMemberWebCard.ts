import { prisma } from './misc'
import { Request, Response } from 'express'
import { uploadImageToGCS } from "./utils/gcsUpload";

export const createFacultyMemberCard = async (req: Request, res: Response) => {
    try {
        const {
            name,
            designation,
            qualification,
            experienceText,
            experienceYears,
            order,
        } = req.body;

        if (!name || !designation) {
            return res.status(400).json({ error: 'name and designation are required' });
        }

        let imageUrl: string | undefined;
        if (req.file) {
            imageUrl = await uploadImageToGCS(req.file, 'facultyWeb');
        }

        const faculty = await prisma.facultyMemberWebCard.create({
            data: {
                name,
                designation,
                qualification,
                experienceText,
                experienceYears: experienceYears ? Number(experienceYears) : null,
                imageUrl,
                order: order ? Number(order) : null,
            },
        });

        res.status(201).json(faculty);
    } catch (err) {
        console.error('Error creating faculty member card:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateFacultyMemberCard = async (req: Request, res: Response) => {
    try {
        const {
            id,
            name,
            designation,
            qualification,
            experienceText,
            experienceYears,
            order,
        } = req.body;

        const data: any = {};

        if (name !== undefined) data.name = name;
        if (designation !== undefined) data.designation = designation;
        if (qualification !== undefined) data.qualification = qualification;
        if (experienceText !== undefined) data.experienceText = experienceText;
        if (experienceYears !== undefined) data.experienceYears = Number(experienceYears);
        if (order !== undefined) data.order = Number(order);

        if (req.file) {
            data.imageUrl = await uploadImageToGCS(req.file, 'facultyWeb');
        }

        const updated = await prisma.facultyMemberWebCard.update({
            where: { id },
            data,
        });

        res.json(updated);
    } catch (err) {
        console.error('Error updating faculty member card:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllFacultyMemberCards = async (_req: Request, res: Response) => {
    try {
        const facultyMembers = await prisma.facultyMemberWebCard.findMany({
            orderBy: { order: 'asc' },
        });

        res.json(facultyMembers);
    } catch (err) {
        console.error('Error fetching faculty member cards:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const deleteFacultyMemberCard = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        await prisma.facultyMemberWebCard.delete({
            where: { id },
        });

        res.json({ message: 'Faculty member deleted successfully' });
    } catch (err) {
        console.error('Error deleting faculty member card:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};




