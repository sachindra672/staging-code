import { prisma } from './misc'
import { Request, Response } from 'express'
import { uploadImageToGCS } from "./utils/gcsUpload";

export const uploadClassCardWeb = async (req: Request, res: Response) => {
    try {
        const { grade, demoPrice } = req.body;

        const imageUrl = req.file
            ? await uploadImageToGCS(req.file, `classCardWeb/grade${grade}`)
            : "";

        const newCard = await prisma.classCardWeb.create({
            data: {
                class: Number(grade),
                educatorImage: imageUrl,
                demoPrice: Number(demoPrice),
            },
        });

        res.status(201).json(newCard);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const getClassCardWeb = async (_req: Request, res: Response) => {
    try {
        const cards = await prisma.classCardWeb.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json(cards);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
}

export const updateClassCardWeb = async (req: Request, res: Response) => {
    const { id, grade, demoPrice } = req.body;

    try {
        let data: any = { demoPrice: Number(demoPrice), class: Number(grade) };

        if (req.file) {
            const imageUrl = await uploadImageToGCS(req.file, `classCardWeb/grade${grade}`);
            data.educatorImage = imageUrl;
        }

        const updatedCard = await prisma.classCardWeb.update({
            where: { id: Number(id) },
            data,
        });

        res.json(updatedCard);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
}