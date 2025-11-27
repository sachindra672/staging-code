import { hashPassword, prisma, verifyPassword } from "./misc"
import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { Prisma, subjectRecord, qualifications } from "@prisma/client";

(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

export async function InsertMentor(req: Request, res: Response) {
    const { name, email, address, phone, dob, searchTags, languages, qualifications, Grades, pass } = req.body;
    const passHash = await hashPassword(pass)
    if (!name || !email || !address || !phone) {
        return res.status(400).json({ err: 'Missing required fields in request body' });
    }
    try {
        const studentCount = 0
        const doubtsSolved = 0
        const averageRating = 0
        const dateOfBirth = new Date(dob)
        const user = await prisma.mentor.create({
            data: {
                name,
                email,
                address,
                phone,
                studentCount,
                doubtsSolved,
                averageRating,
                dateOfBirth,
                searchTags,
                languages,
                Grades,
                passHash,
                qualifications: {
                    create: qualifications
                }
            }
        });
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Internal server error',
            stack: JSON.stringify(error)
        });
    }
}

export async function updateMentorPassword(req: Request, res: Response) {
    try {

        const { id, currentPass, newPass } = req.body
        if (!currentPass || !newPass || !id) {
            return res.json({ success: false, messsage: "both new and existing password are required" })
        }

        const existingHash = (await prisma.mentor.findUniqueOrThrow({ where: { id }, select: { passHash: true } })).passHash

        const passwordMatch = await verifyPassword(currentPass, existingHash)

        if (!passwordMatch) {
            return res.json({ success: false, message: "incorrect current password" })
        }

        const newHash = await hashPassword(newPass)

        await prisma.mentor.update({ where: { id }, data: { passHash: newHash } })

        return res.json({ success: true, message: "password successfully changed" })
    } catch (error) {
        console.error('Error updating mentor:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2001') {
                return res.status(404).json({ success: false, error: 'Mentor not found' });
            }
        }

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

export async function updateMentorPassword2(req: Request, res: Response) {
    try {

        const { id, newPass } = req.body
        if (!newPass || !id) {
            return res.json({ success: false, messsage: "both new and existing password are required" })
        }

        // const existingHash = (await prisma.mentor.findUniqueOrThrow({ where: { id }, select: { passHash: true } })).passHash

        // const passwordMatch = await verifyPassword(currentPass, existingHash)

        // if (!passwordMatch) {
        //     return res.json({ success: false, message: "incorrect current password" })
        // }

        const newHash = await hashPassword(newPass)

        await prisma.mentor.update({ where: { id }, data: { passHash: newHash } })

        return res.json({ success: true, message: "password successfully changed" })
    } catch (error) {
        console.error('Error updating mentor:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2001') {
                return res.status(404).json({ success: false, error: 'Mentor not found' });
            }
        }

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

export async function updateMentor(req: Request, res: Response) {
    try {
        const {
            id,
            name,
            email,
            address,
            phone,
            dob,
            Grades,
            searchTags,
            languages,
            imageData,
            coverImageData,
            isActive,
            subjectRecordList,
            qualificationList
        } = req.body;

        const missingFields: string[] = [];
        if (!id) missingFields.push('id');
        if (name === undefined) missingFields.push('name');
        if (email === undefined) missingFields.push('email');
        if (address === undefined) missingFields.push('address');
        if (phone === undefined) missingFields.push('phone');

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                missingFields
            });
        }

        let dateOfBirth: Date | undefined;
        if (dob) {
            dateOfBirth = new Date(dob);
            if (isNaN(dateOfBirth.getTime())) {
                return res.status(400).json({ success: false, error: 'Invalid date of birth format' });
            }
        }

        const modefiedOn = new Date();
        const updatedMentor = await prisma.mentor.update({
            where: { id: Number(id) },
            data: {
                name,
                email,
                address,
                phone,
                dateOfBirth,
                searchTags,
                languages,
                modefiedOn,
                Grades,
                isActive,
            }
        });

        if (!updatedMentor) {
            return res.status(404).json({ success: false, error: 'Mentor not found' });
        }

        if (subjectRecordList && subjectRecordList.length > 0) {
            await prisma.subjectRecord.deleteMany({ where: { mentorId: updatedMentor.id } });
            await prisma.subjectRecord.createMany({ data: subjectRecordList });
        }

        if (qualificationList && qualificationList.length > 0) {
            await prisma.qualifications.deleteMany({ where: { mentorId: updatedMentor.id } });
            await prisma.qualifications.createMany({ data: qualificationList });
        }

        const saveImage = (base64Data: string, targetDir: string, filename: string) => {
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const imageDir = path.join(__dirname, targetDir);
            const imagePath = path.join(imageDir, filename);

            fs.mkdirSync(imageDir, { recursive: true });
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            //@ts-ignore
            fs.writeFileSync(imagePath, imageBuffer);
        };

        try {
            if (imageData && imageData !== '') {
                saveImage(imageData, '../thumbs/mentors', `${updatedMentor.id}.jpg`);
            }

            if (coverImageData && coverImageData !== '') {
                saveImage(coverImageData, '../thumbs/mentors/cover', `${updatedMentor.id}.jpg`);
            }
        } catch (fileError) {
            console.error('File handling error:', fileError);
            return res.status(500).json({
                success: false,
                error: 'Error saving image files',
                details: fileError instanceof Error ? fileError.message : 'Unknown file error'
            });
        }

        res.json({ success: true, updatedMentor });

    } catch (error: unknown) {
        console.error('Error updating mentor:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2001') {
                return res.status(404).json({ success: false, error: 'Mentor not found' });
            }
        }

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}


export async function GetMyCourses(req: Request, res: Response) {
    const { mentorId } = req.body

    try {
        const courses = await prisma.courses.findMany({ where: { mentorId } })
        res.json(courses)
    } catch (error) {
        res.status(500).json({ error })
    }
}



export async function GetMentorsByClasses(req: Request, res: Response) {
    const { grade } = req.body

    try {
        const mentors = await prisma.mentor.findMany({ where: { Grades: { has: grade } } })
        res.send({ success: true, mentors })
    } catch (error) {
        console.log(error)
        res.status(500).send({ succes: false, message: error })
    }
}

// export async function GetMentorBySubject(req: Request, res: Response) {
//     const { subjectId } = req.body

//     try {
//         const records = await prisma.subjectRecord.findMany({ where: { subjectId, mentorId: { not: null } }, include: { mentor: true } })
//         res.send({ success: true, records })
//     } catch (error) {
//         console.log(error)
//         res.status(500).send({ succes: false, message: error })
//     }
// }

export async function GetMentorBySubject(req: Request, res: Response) {
    const { subjectId } = req.body;

    try {
        const records = await prisma.subjectRecord.findMany({
            where: {
                subjectId,
                mentorId: { not: null },
                mentor: {
                    isActive: true,  
                },
            },
            include: {
                mentor: true,
            },
        });

        res.send({ success: true, records });
    } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, message: error });
    }
}


export async function GetMentorData(req: Request, res: Response) {
    const { id } = req.body

    try {
        const mentor = await prisma.mentor.findUnique({ where: { id }, include: { qualifications: true } })
        res.send({ success: true, mentor })
    } catch (error) {
        console.log(error)
        res.status(500).send({ succes: false, message: error })
    }
}

export async function GetMyMentors(req: Request, res: Response): Promise<void> {
    const { userId } = req.body;

    // Validate required fields
    if (!userId) {
        res.status(400).json({ success: false, error: 'User ID is required' });
        return;
    }

    try {
        const purchases = await prisma.purchases.findMany({
            where: { endUsersId: Number(userId) },
            select: { coursesId: true },
        });

        const courseIds = purchases.map(purchase => purchase.coursesId);

        if (courseIds.length === 0) {
            res.status(404).json({ success: false, error: 'No courses found for this user' });
            return;
        }

        const mentors = await prisma.courses.findMany({
            where: { id: { in: courseIds } },
            select: { mentorId: true, mentor: { select: { name: true } } },
        });

        if (mentors.length === 0) {
            res.status(404).json({ success: false, error: 'No mentors found for the user\'s courses' });
            return;
        }

        // Format the response to include mentor IDs and names
        const mentorDetails = mentors.map(course => ({
            mentorId: course.mentorId,
            mentorName: course.mentor.name,
        }));

        res.json({ success: true, mentors: mentorDetails });
    } catch (error: unknown) {
        console.error('Error fetching mentors:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // Handle specific Prisma error codes
            switch (error.code) {
                case 'P2001': // Record not found
                    res.status(404).json({ success: false, error: 'User not found' });
                    break;
                case 'P2002': // Unique constraint violation
                    res.status(409).json({ success: false, error: 'Unique constraint violated' });
                    break;
                default:
                    res.status(500).json({
                        success: false,
                        error: 'Database error occurred',
                        details: error.message,
                    });
                    break;
            }
        } else {
            // General error handling
            res.status(500).json({
                success: false,
                error: 'An error occurred while fetching mentors.',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
}


