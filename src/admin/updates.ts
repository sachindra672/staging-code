import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../misc'
import { MentorUpdate } from './classes';



export async function updateMentor(req: Request, res: Response) {
    try {
        const mentorUpdate = new MentorUpdate(req.body);

        const validationError = mentorUpdate.validate();
        if (validationError) {
            return res.status(400).json({ success: false, error: validationError });
        }

        const parsedDob = mentorUpdate.parseDob();

        const data: { [key: string]: any } = {
            name: mentorUpdate.name,
            email: mentorUpdate.email,
            address: mentorUpdate.address,
            phone: mentorUpdate.phone,
            dateOfBirth: parsedDob || undefined,
            searchTags: mentorUpdate.searchTags,
            languages: mentorUpdate.languages,
            Grades: mentorUpdate.Grades,
            qualifications: mentorUpdate.qualifications ? {
                set: mentorUpdate.qualifications
            } : undefined,
            subjectRecord: mentorUpdate.subjectRecords ? {
                set: mentorUpdate.subjectRecords
            } : undefined,
        };

        // Filter out undefined values (in case some fields are not updated)
        Object.keys(data).forEach(key => {
            if (data[key] === undefined) {
                delete data[key];
            }
        });

        const updatedMentor = await prisma.mentor.update({
            where: { id: mentorUpdate.id },
            data,
        });

        return res.status(200).json({ success: true, mentor: updatedMentor });
    } catch (error) {
        console.error('Error updating mentor:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return res.status(400).json({ success: false, error: 'Database error', message: error.message });
        } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
            return res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
        } else {
            return res.status(400).json({ success: false, error: error });
        }
    }
}