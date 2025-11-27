import { Request, Response } from "express";
import { prisma } from "./misc";
import { getCache, setCache, invalidateCache } from "./utils/cacheUtils";
import { Storage } from "@google-cloud/storage";
import { nanoid } from "nanoid";

const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GCP_KEYFILE_PATH,
});

const bucket = storage.bucket(process.env.GCP_BUCKET!);

export const generateNewsAssetUploadUrl = async (_req: Request, res: Response) => {
    try {
        const date = new Date();
        const fileName = `news-assets/${nanoid()}-${date.getTime()}.jpeg`;
        const file = bucket.file(fileName);

        const [url] = await file.getSignedUrl({
            version: "v4",
            action: "write",
            expires: Date.now() + 10 * 60 * 1000,
            contentType: 'image/*',
        });

        res.json({
            uploadUrl: url,
            filePath: `https://storage.googleapis.com/${process.env.GCP_BUCKET}/${fileName}`,
        });
    } catch (err) {
        console.error("Error generating GCS upload URL:", err);
        res.status(500).json({ error: "Failed to generate upload URL" });
    }
};

export const getAllNews = async (req: Request, res: Response) => {
    try {
        const page = Number(req.body.page) || 1;
        const limit = Number(req.body.limit) || 10;
        const skip = (page - 1) * limit;

        const cacheKey = `news:page:${page}:limit:${limit}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json({ cached: true, ...cached });

        const [newsList, total] = await Promise.all([
            prisma.news.findMany({
                skip,
                take: limit,
                orderBy: { publishedAt: "desc" },
                where: { deleted: false },
            }),
            prisma.news.count({
                where: { deleted: false },
            }),
        ]);

        const data = { total, page, limit, newsList };
        await setCache(cacheKey, data, 120);
        res.json(data);
    } catch (err) {
        console.error("Error fetching news:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const createNews = async (req: Request, res: Response) => {
    try {
        const { title, banner, des, content, authorName, authorProfile } = req.body;

        const newNews = await prisma.news.create({
            data: { title, banner, des, content, authorName, authorProfile },
        });

        await invalidateCache("news:*");
        res.json(newNews);
    } catch (err) {
        console.error("Error creating news:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const getNewsById = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;
        const cacheKey = `news:${id}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const news = await prisma.news.findFirst({
            where: { id, deleted: false },
        });

        if (!news) return res.status(404).json({ error: "News not found" });

        await setCache(cacheKey, news, 180);
        res.json(news);
    } catch (err) {
        console.error("Error fetching news by ID:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


export const updateNews = async (req: Request, res: Response) => {
    try {
        const { id, title, banner, des, content, authorName, authorProfile } = req.body;

        const updated = await prisma.news.update({
            where: { id },
            data: { title, banner, des, content, authorName, authorProfile },
        });

        await invalidateCache(`news:${id}`);
        await invalidateCache("news:*");
        res.json(updated);
    } catch (err) {
        console.error("Error updating news:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const deleteNews = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        const updated = await prisma.news.update({
            where: { id },
            data: {
                deleted: true,
                deletedAt: new Date(),
            },
        });

        await invalidateCache(`news:${id}`);
        await invalidateCache("news:*");

        res.json({ success: true, message: "News soft-deleted successfully" });
    } catch (err) {
        console.error("Error soft deleting news:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

