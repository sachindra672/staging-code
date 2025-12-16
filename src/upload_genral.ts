import { Request, Response } from "express";
import { nanoid } from "nanoid";
import { Storage } from "@google-cloud/storage";

const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GCP_KEYFILE_PATH,
});

const bucket = storage.bucket(process.env.GCP_BUCKET!);

export const generateUploadUrl = async (req: Request, res: Response) => {
    try {
        const { folderPath, fileName, mimeType } = req.body;

        if (!folderPath || !fileName || !mimeType) {
            return res.status(400).json({
                error: "Missing required fields (folderPath, fileName, mimeType)",
            });
        }

        const ext = fileName.includes(".")
            ? `.${fileName.split(".").pop()}`
            : "";

        const safeFolder = folderPath.replace(/^\/+|\/+$/g, "");
        const objectPath = `${safeFolder}/${nanoid()}-${Date.now()}${ext}`;

        const file = bucket.file(objectPath);

        const [uploadUrl] = await file.getSignedUrl({
            version: "v4",
            action: "write",
            expires: Date.now() + 10 * 60 * 1000,
            contentType: mimeType,
        });

        return res.json({
            uploadUrl,
            filePath: `https://storage.googleapis.com/${process.env.GCP_BUCKET}/${objectPath}`,
            objectPath,
        });
    } catch (error) {
        console.error("GCS upload URL error:", error);
        res.status(500).json({ error: "Failed to generate upload URL" });
    }
};
