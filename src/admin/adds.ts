import path from 'path';
import fs from 'fs'
import { prisma, uploadImage } from '../misc'
import { Request, Response } from 'express'
import { Prisma } from '@prisma/client';
import { error } from 'console';
import { createGroupForCourse } from '../courseGroupChat';

interface TeachIntroData {
    comment: string;
    mentorId: number;
    subjectId: number;
}

export interface CreateBigCourseRequest {
    name: string;
    slug: string;
    imageData: string,
    searchTags: string[];
    prerequisites: string[];
    syllabus: string[];
    category?: string;
    description: string;
    level?: string;
    price: number;
    partialPrice?: number;
    currentPrice: number;
    isLongTerm: boolean;
    startDate: string;
    endDate: string;
    averageRating: number;
    duration: number;
    thumbnailUrl: string;
    language: string;
    grade: string;
    mentorList: number[];
    subjectList: number[];
    TeachIntroData: TeachIntroData[];
    isFree: boolean
    mainImageData: string
}

export async function AddMentor(req: Request, res: Response) {
    const { name, email, address, phone, dob, searchTags, languages, qualifications, Grades, subjectRecords, imageData, coverImageData } = req.body;

    // Validate required fields
    if (!name || !email || !address || !phone || !imageData) {
        console.error("missing fields")
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        console.error("email check failed")

        return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    if (!/^\d+$/.test(phone)) {
        console.error("phone check failed")

        return res.status(400).json({ success: false, error: 'Invalid phone number format' });
    }

    const dateOfBirth = new Date(dob);
    if (isNaN(dateOfBirth.getTime())) {
        console.error("dob check failed fields")

        return res.status(400).json({ success: false, error: 'Invalid date of birth' });
    }

    if (searchTags && typeof searchTags != 'string') {
        console.error("search tag check failed")

        return res.status(400).json({ success: false, error: 'searchTags must be an string' });
    }
    if (languages && typeof languages != 'string') {
        console.error("language failed")

        return res.status(400).json({ success: false, error: 'languages must be an string' });
    }
    if (Grades && !Array.isArray(Grades)) {
        console.error("grades failed")

        return res.status(400).json({ success: false, error: 'Grades must be an array' });
    }
    if (!Array.isArray(qualifications) || !Array.isArray(subjectRecords)) {
        console.error("subjects failed")

        return res.status(400).json({ success: false, error: 'qualifications and subjectRecords must be arrays' });
    }

    try {
        const mentor = await prisma.mentor.create({
            data: {
                name,
                email,
                address,
                phone,
                studentCount: 0,
                doubtsSolved: 0,
                averageRating: 0,
                dateOfBirth,
                searchTags,
                languages,
                Grades,
                subjectRecord: { create: subjectRecords },
                qualifications: { create: qualifications },
            }
        });

        await uploadImage(imageData, mentor.id, "/mentors")

        // Upload cover image 
        if (coverImageData) {
            await uploadImage(coverImageData, mentor.id, "/mentors/cover");
        }

        res.status(201).json({ success: true, mentor });
    } catch (error) {
        console.error('Error in AddMentor:', error);

        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({
                    success: false,
                    error: 'Database error',
                    message: error.message
                });
                console.error(error)
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Internal server error',
                    message: error.message
                });
                console.error(error)

            }
        } else {
            res.status(500).json({
                success: false,
                error: 'An unexpected error occurred'
            });
            console.error(error)
        }
    }
}

export async function AddTeachIntro(req: Request, res: Response) {
    const { mentorId, subjectId, bigCourseId, comment } = req.body;

    if (!mentorId || !subjectId || !bigCourseId) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const mentorIdNumber = Number(mentorId);
    const subjectIdNumber = Number(subjectId);
    const bigCourseIdNumber = Number(bigCourseId);

    if (isNaN(mentorIdNumber) || mentorIdNumber <= 0 ||
        isNaN(subjectIdNumber) || subjectIdNumber <= 0 ||
        isNaN(bigCourseIdNumber) || bigCourseIdNumber <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
    }

    if (comment !== undefined && typeof comment !== 'string') {
        return res.status(400).json({ success: false, error: 'Comment must be a string' });
    }

    try {
        const intro = await prisma.teachIntro.create({
            data: {
                mentorId: mentorIdNumber,
                subjectId: subjectIdNumber,
                bigCourseId: bigCourseIdNumber,
                comment,
            }
        });

        res.status(201).json({ success: true, intro });
    } catch (error) {
        console.error('Error in AddTeachIntro:', error);

        if (error instanceof Error) {
            if (error.name === 'PrismaClientKnownRequestError') {
                res.status(400).json({
                    success: false,
                    error: 'Database error',
                    message: error.message
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Internal server error',
                    message: error.message
                });
            }
        } else {
            res.status(500).json({
                success: false,
                error: 'An unexpected error occurred'
            });
        }
    }
}


export async function createBigCourse(req: Request, res: Response): Promise<void> {
    const {
        name,
        slug,
        searchTags,
        prerequisites,
        syllabus,
        category,
        description,
        level,
        price,
        partialPrice,
        currentPrice,
        isLongTerm,
        startDate,
        endDate,
        averageRating,
        duration,
        thumbnailUrl,
        language,
        grade,
        imageData,
        mainImageData,
        mentorList,
        subjectList,
        TeachIntroData,
        isFree
    }: CreateBigCourseRequest = req.body;

    if (!name || !description || price === undefined || currentPrice === undefined || isLongTerm === undefined || !startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Missing required fields' });
        return;
    }

    if (!slug) {
        res.status(400).json({ success: false, error: 'provide slug it will help to determine the group name' })
    }


    if (typeof price !== 'number' || typeof currentPrice !== 'number' || typeof partialPrice != 'number' || (averageRating !== undefined && typeof averageRating !== 'number')) {
        res.status(400).json({ success: false, error: 'Invalid numeric field' });
        return;
    }

    if (!Array.isArray(searchTags) || !Array.isArray(prerequisites) || !Array.isArray(syllabus) || !Array.isArray(mentorList) || !Array.isArray(subjectList)) {
        res.status(400).json({ success: false, error: 'Invalid array field' });
        return;
    }

    if (!Array.isArray(TeachIntroData)) {
        res.status(400).json({ success: false, error: 'Invalid TeachIntroData field' });
        return;
    }

    for (const intro of TeachIntroData) {
        if (typeof intro.comment !== 'string' || typeof intro.mentorId !== 'number' || typeof intro.subjectId !== 'number') {
            res.status(400).json({ success: false, error: 'Invalid TeachIntroData entry' });
            return;
        }
    }

    try {
        const parsedStartDate = new Date(startDate);
        const parsedEndDate = new Date(endDate);
        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            res.status(400).json({ success: false, error: 'Invalid date format' });
            return;
        }
        const newBigCourse = await prisma.bigCourse.create({
            data: {
                name,
                slug,
                isFree,
                searchTags,
                prerequisites,
                syllabus,
                category,
                description,
                level,
                price,
                partialPrice,
                currentPrice,
                isLongTerm,
                startDate: parsedStartDate,
                endDate: parsedEndDate,
                averageRating,
                duration,
                thumbnailUrl,
                language,
                grade,
                mentorList,
                subjectList,
                enrolledStudents: 0,
                isActive: true,
                createdOn: new Date(),
                modifiedOn: new Date(),
                TeachIntro: {
                    create: TeachIntroData.map((intro) => ({
                        comment: intro.comment,
                        mentorId: intro.mentorId,
                        subjectId: intro.subjectId,
                    })),
                },
            },
        });

        uploadImage(imageData, newBigCourse.id, "courses")
        uploadImage(mainImageData, newBigCourse.id, "mcourses")
        await createGroupForCourse(newBigCourse.id);
        await prisma.announcements.create({ data: { content: `new course ${newBigCourse.name}! ` } })
        res.status(201).json({ success: true, bigCourse: newBigCourse });
    } catch (error) {
        console.error('Error creating BigCourse:', error);
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

interface intros {
    id: number,
    comment: string,
    mentorId: number,
    subjectId: number,
    bigCourseId: number,
    createdOn: string,
    modifiedOn: string
}

export async function updateBigCourse(req: Request, res: Response) {
    const {
        id,
        name,
        searchTags,
        prerequisites,
        syllabus,
        category,
        description,
        level,
        price,
        partialPrice,
        currentPrice,
        isLongTerm,
        startDate,
        endDate,
        averageRating,
        duration,
        thumbnailUrl,
        language,
        grade,
        imageData,
        mentorList,
        subjectList,
        isActive,
        isFree,
        mainImageData,
        TiArr
    } = req.body;

    console.log(`reached here to update course`);

    if (!id) {
        res.status(400).json({ success: false, error: 'Course ID is required' });
        return;
    }

    if (price !== undefined && typeof price !== 'number' ||
        partialPrice !== undefined && typeof partialPrice !== 'number' ||
        currentPrice !== undefined && typeof currentPrice !== 'number' ||
        averageRating !== undefined && typeof averageRating !== 'number') {
        res.status(400).json({ success: false, error: 'Invalid numeric field' });
        return;
    }

    if (searchTags && !Array.isArray(searchTags) ||
        prerequisites && !Array.isArray(prerequisites) ||
        syllabus && !Array.isArray(syllabus) ||
        mentorList && !Array.isArray(mentorList) ||
        subjectList && !Array.isArray(subjectList)) {
        res.status(400).json({ success: false, error: 'Invalid array field' });
        return;
    }

    try {
        const parsedStartDate = startDate ? new Date(startDate) : undefined;
        const parsedEndDate = endDate ? new Date(endDate) : undefined;

        if (parsedStartDate && isNaN(parsedStartDate.getTime()) ||
            parsedEndDate && isNaN(parsedEndDate.getTime())) {
            res.status(400).json({ success: false, error: 'Invalid date format' });
            return;
        }

        const updatedBigCourse = await prisma.bigCourse.update({
            where: { id: Number(id) },
            data: {
                name,
                searchTags,
                prerequisites,
                syllabus,
                category,
                description,
                level,
                price,
                partialPrice,
                currentPrice,
                isLongTerm,
                startDate: parsedStartDate,
                endDate: parsedEndDate,
                averageRating,
                duration,
                thumbnailUrl,
                language,
                grade,
                mentorList,
                subjectList,
                modifiedOn: new Date(),
                isActive,
                isFree
            },
        });


        await uploadImage(imageData, updatedBigCourse.id, "courses").catch(console.log)
        await uploadImage(mainImageData, updatedBigCourse.id, "mcourses").catch(console.log)

        const introData = TiArr as intros[]
        console.log("checking update teach intros")

        console.log(TiArr)

        if (Array.isArray(TiArr) && TiArr.length !== 0) {
            console.log("updating teach intros")
            try {
                await prisma.teachIntro.deleteMany({ where: { bigCourseId: id } });

                await Promise.all(introData.map(e =>
                    prisma.teachIntro.create({
                        data: {
                            comment: e.comment,
                            mentorId: e.mentorId,
                            bigCourseId: id,
                            subjectId: e.subjectId,
                            createdOn: new Date(),
                            modifiedOn: new Date(),
                        }
                    })
                ));

            } catch (error) {
                console.error("Error in processing TeachIntro:", error);
            }
        }

        res.status(200).json({ success: true, bigCourse: updatedBigCourse });
    } catch (error: unknown) {
        console.error('Error updating BigCourse:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') { // Handle unique constraint violation
                return res.status(409).json({ success: false, error: 'A unique constraint was violated', details: error.message });
            }
        } else if (error instanceof Prisma.PrismaClientValidationError) {
            return res.status(400).json({ success: false, error: 'Validation error', details: error.message });
        } else if (error instanceof Prisma.PrismaClientRustPanicError) {
            return res.status(500).json({ success: false, error: 'Prisma internal error', details: error.message });
        } else if (error instanceof Prisma.PrismaClientInitializationError) {
            return res.status(500).json({ success: false, error: 'Prisma initialization error', details: error.message });
        } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
            return res.status(500).json({ success: false, error: 'Prisma unknown error', details: error.message });
        } else {
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
}

export async function updateBigCourse2(req: Request, res: Response) {
    const {
        id,
        name,
        searchTags,
        prerequisites,
        syllabus,
        category,
        description,
        level,
        price,
        partialPrice,
        currentPrice,
        isLongTerm,
        startDate,
        endDate,
        averageRating,
        duration,
        thumbnailUrl,
        language,
        grade,
        imageData,
        mentorList,
        subjectList,
        isActive,
        isFree,
        mainImageData,
        TiArr
    } = req.body;

    console.log(`[updateBigCourse] Incoming request at ${new Date().toISOString()}`);
    console.log(`[updateBigCourse] Course ID:`, id);

    if (!id) {
        console.warn(`[updateBigCourse] Missing course ID`);
        res.status(400).json({ success: false, error: 'Course ID is required' });
        return;
    }

    if (price !== undefined && typeof price !== 'number' ||
        partialPrice !== undefined && typeof partialPrice !== 'number' ||
        currentPrice !== undefined && typeof currentPrice !== 'number' ||
        averageRating !== undefined && typeof averageRating !== 'number') {
        console.warn(`[updateBigCourse] Invalid numeric field in request`);
        res.status(400).json({ success: false, error: 'Invalid numeric field' });
        return;
    }

    if (searchTags && !Array.isArray(searchTags) ||
        prerequisites && !Array.isArray(prerequisites) ||
        syllabus && !Array.isArray(syllabus) ||
        mentorList && !Array.isArray(mentorList) ||
        subjectList && !Array.isArray(subjectList)) {
        console.warn(`[updateBigCourse] Invalid array field in request`);
        res.status(400).json({ success: false, error: 'Invalid array field' });
        return;
    }

    try {
        const parsedStartDate = startDate ? new Date(startDate) : undefined;
        const parsedEndDate = endDate ? new Date(endDate) : undefined;

        if (parsedStartDate && isNaN(parsedStartDate.getTime()) ||
            parsedEndDate && isNaN(parsedEndDate.getTime())) {
            console.warn(`[updateBigCourse] Invalid date format`, { startDate, endDate });
            res.status(400).json({ success: false, error: 'Invalid date format' });
            return;
        }

        console.log(`[updateBigCourse] Updating BigCourse in DB...`);
        const updatedBigCourse = await prisma.bigCourse.update({
            where: { id: Number(id) },
            data: {
                name,
                searchTags,
                prerequisites,
                syllabus,
                category,
                description,
                level,
                price,
                partialPrice,
                currentPrice,
                isLongTerm,
                startDate: parsedStartDate,
                endDate: parsedEndDate,
                averageRating,
                duration,
                thumbnailUrl,
                language,
                grade,
                mentorList,
                subjectList,
                modifiedOn: new Date(),
                isActive,
                isFree
            },
        });
        console.log(`[updateBigCourse] BigCourse updated successfully: ${updatedBigCourse.id}`);

        // Only upload if valid image data is provided (preserves existing images if no data sent)
        if (imageData && typeof imageData === 'string' && imageData.trim() !== '') {
            console.log(`[updateBigCourse] Uploading course image...`);
            await uploadImage(imageData, updatedBigCourse.id, "courses").catch(e =>
                console.error(`[updateBigCourse] Error uploading imageData:`, e)
            );
        } else {
            console.log(`[updateBigCourse] No imageData provided, preserving existing image`);
        }

        // Only upload if valid main image data is provided (preserves existing image if no data sent)
        if (mainImageData && typeof mainImageData === 'string' && mainImageData.trim() !== '') {
            console.log(`[updateBigCourse] Uploading main course image...`);
            await uploadImage(mainImageData, updatedBigCourse.id, "mcourses").catch(e =>
                console.error(`[updateBigCourse] Error uploading mainImageData:`, e)
            );
        } else {
            console.log(`[updateBigCourse] No mainImageData provided, preserving existing image`);
        }

        console.log(`[updateBigCourse] Processing TiArr (teach intros)... length:`, TiArr?.length);

        if (Array.isArray(TiArr) && TiArr.length > 0) {
            try {
                console.log(`[updateBigCourse] Deleting old teachIntros for courseId=${id}`);
                await prisma.teachIntro.deleteMany({ where: { bigCourseId: Number(id) } });

                console.log(`[updateBigCourse] Creating ${TiArr.length} new teachIntros`);
                await Promise.all(
                    (TiArr as intros[]).map(e =>
                        prisma.teachIntro.create({
                            data: {
                                comment: e.comment,
                                mentorId: e.mentorId,
                                bigCourseId: Number(id),
                                subjectId: e.subjectId,
                                createdOn: new Date(),
                                modifiedOn: new Date(),
                            }
                        })
                    )
                );
                console.log(`[updateBigCourse] TeachIntros updated successfully`);
            } catch (error) {
                console.error(`[updateBigCourse] Error in processing TeachIntro:`, error);
            }
        }

        console.log(`[updateBigCourse] Finished successfully, sending response...`);
        res.status(200).json({ success: true, bigCourse: updatedBigCourse });
    } catch (error: unknown) {
        console.error(`[updateBigCourse] ERROR at ${new Date().toISOString()}:`, error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                return res.status(409).json({ success: false, error: 'A unique constraint was violated', details: error.message });
            }
        } else if (error instanceof Prisma.PrismaClientValidationError) {
            return res.status(400).json({ success: false, error: 'Validation error', details: error.message });
        } else if (error instanceof Prisma.PrismaClientRustPanicError) {
            return res.status(500).json({ success: false, error: 'Prisma internal error', details: error.message });
        } else if (error instanceof Prisma.PrismaClientInitializationError) {
            return res.status(500).json({ success: false, error: 'Prisma initialization error', details: error.message });
        } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
            return res.status(500).json({ success: false, error: 'Prisma unknown error', details: error.message });
        } else {
            return res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
}
