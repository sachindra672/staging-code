import { prisma } from './misc'
import { Request, Response } from 'express'
import { uploadImageToGCS } from "./utils/gcsUpload";

export const createTestimonialCard = async (req: Request, res: Response) => {
    try {
        const {
            name,
            role,
            grade,
            content,
            studentName,
            courseEnrolled,
            order,
            isVisible,
        } = req.body;

        if (!name || !role || !content) {
            return res.status(400).json({ error: 'name, role and content are required' });
        }

        let profileImage: string | undefined;
        if (req.file) {
            profileImage = await uploadImageToGCS(req.file, 'testimonialProfileImage');
        }

        const testimonial = await prisma.testimonialCard.create({
            data: {
                name,
                role,
                grade,
                content,
                studentName,
                courseEnrolled,
                order: order ? Number(order) : 0,
                isVisible: isVisible !== undefined ? isVisible === 'true' || isVisible === true : true,
                profileImage,
            },
        });

        res.status(201).json(testimonial);
    } catch (err) {
        console.error('Error creating testimonial card:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateTestimonialCard = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;
        const {
            name,
            role,
            grade,
            content,
            studentName,
            courseEnrolled,
            order,
            isVisible,
        } = req.body;

        const data: any = {};

        if (name !== undefined) data.name = name;
        if (role !== undefined) data.role = role;
        if (grade !== undefined) data.grade = grade;
        if (content !== undefined) data.content = content;
        if (studentName !== undefined) data.studentName = studentName;
        if (courseEnrolled !== undefined) data.courseEnrolled = courseEnrolled;
        if (order !== undefined) data.order = Number(order);
        if (isVisible !== undefined) data.isVisible = isVisible === 'true' || isVisible === true;

        if (req.file) {
            data.profileImage = await uploadImageToGCS(req.file, 'testimonialProfileImage');
        }

        const updated = await prisma.testimonialCard.update({
            where: { id },
            data,
        });

        res.json(updated);
    } catch (err) {
        console.error('Error updating testimonial card:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllTestimonialCards = async (_req: Request, res: Response) => {
    try {
        const testimonials = await prisma.testimonialCard.findMany({
            orderBy: { order: 'asc' },
        });

        res.json(testimonials);
    } catch (err) {
        console.error('Error fetching testimonial cards:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const deleteTestimonialCard = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        await prisma.testimonialCard.delete({
            where: { id },
        });

        res.json({ message: 'Testimonial deleted successfully' });
    } catch (err) {
        console.error('Error deleting testimonial card:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};



