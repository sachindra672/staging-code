import { Request, Response } from "express";
import { prisma } from './misc'
import { uploadImageToGCS } from "./utils/gcsUpload";

export const createSipCarousel1 = async (req: Request, res: Response) => {
    try {
        const { href } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: "Image is required" });
        }

        const imageUrl = await uploadImageToGCS(req.file, "sipCraousel1");

        const item = await prisma.sipCraousel1.create({
            data: { imageLink: imageUrl, href },
        });

        res.json(item);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getSipCarousel1 = async (_req: Request, res: Response) => {
    try {
        const items = await prisma.sipCraousel1.findMany({
            orderBy: { order: "asc" },
        });
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteSipCarousel1 = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.sipCraousel1.delete({ where: { id } });
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const createSipCarousel2 = async (req: Request, res: Response) => {
    try {
        const { href } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: "Image is required" });
        }

        const imageUrl = await uploadImageToGCS(req.file, "sipCraousel2");

        const item = await prisma.sipCraousel2.create({
            data: { imageLink: imageUrl, href },
        });

        res.json(item);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getSipCarousel2 = async (_req: Request, res: Response) => {
    try {
        const items = await prisma.sipCraousel2.findMany({
            orderBy: { order: "asc" },
        });
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteSipCarousel2 = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.sipCraousel2.delete({ where: { id } });
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const createSipAppointmentLead = async (req: Request, res: Response) => {
    try {
        const { mobileNumber, name, role, institute, location, preferredBoard } = req.body;

        if (!mobileNumber || !name || !role || !preferredBoard) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const lead = await prisma.sipAppointmentLead.create({
            data: { mobileNumber, name, role, institute, location, preferredBoard },
        });

        res.json(lead);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getSipAppointmentLeads = async (_req: Request, res: Response) => {
    try {
        const leads = await prisma.sipAppointmentLead.findMany({
            orderBy: { createdAt: "desc" }
        });
        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const createSipMentor = async (req: Request, res: Response) => {
    try {
        const { name, institute } = req.body;

        if (!name) {
            return res.status(400).json({ error: "Name is required" });
        }

        let imageUrl: string | undefined = undefined;

        if (req.file) {
            imageUrl = await uploadImageToGCS(req.file, "sipMentor");
        }

        const mentor = await prisma.sipMentor.create({
            data: {
                name,
                institute,
                imageLink: imageUrl
            },
        });

        res.json(mentor);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getSipMentors = async (_req: Request, res: Response) => {
    try {
        const mentors = await prisma.sipMentor.findMany({
            orderBy: { order: "asc" },
        });
        res.json(mentors);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteSipMentor = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.sipMentor.delete({ where: { id } });
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateSipMentorOrder = async (req: Request, res: Response) => {
    try {
        const { id, order } = req.body;

        if (!id) return res.status(400).json({ error: "ID required" });

        await prisma.sipMentor.update({
            where: { id },
            data: { order },
        });

        res.json({ message: "Order updated successfully" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};
