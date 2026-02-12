import { Request, Response } from "express";
import { nanoid } from "nanoid";
import { Storage } from "@google-cloud/storage";
import { prisma } from "./misc";

const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GCP_KEYFILE_PATH,
});

const bucket = storage.bucket(process.env.GCP_BUCKET!);

export const generateGlobalMaterialUploadUrl = async (req: Request, res: Response) => {
    try {
        const { className, type, fileName, mimeType } = req.body;

        if (!className || !type || !fileName || !mimeType) {
            return res.status(400).json({ error: "Missing required fields (className, type, fileName, mimeType)" });
        }

        // Construct path in GCS
        const ext = fileName.split(".").pop();
        const safeExt = ext ? `.${ext}` : "";
        const objectPath = `globalMaterialUpload/${className}/${type}/${nanoid()}-${Date.now()}${safeExt}`;

        const file = bucket.file(objectPath);

        const [uploadUrl] = await file.getSignedUrl({
            version: "v4",
            action: "write",
            expires: Date.now() + 10 * 60 * 1000, // 10 minutes
            contentType: mimeType,
        });

        res.json({
            uploadUrl,
            filePath: `https://storage.googleapis.com/${process.env.GCP_BUCKET}/${objectPath}`,
        });
    } catch (err) {
        console.error("Error generating GCS upload URL:", err);
        res.status(500).json({ error: "Failed to generate upload URL" });
    }
};

export const saveGlobalMaterialMetadata = async (req: Request, res: Response) => {
    try {
        const { className, type, fileName, fileUrl, uploadedBy, size, mimeType } = req.body;

        if (!className || !type || !fileName || !fileUrl)
            return res.status(400).json({ error: "Missing required fields" });

        const newMaterial = await prisma.globalMaterial.create({
            data: {
                className,
                type,
                fileName,
                fileUrl,
                uploadedBy,
                size: size ? Number(size) : null,
                mimeType,
            },
        });

        res.json({ success: true, data: newMaterial });
    } catch (err) {
        console.error("Error saving material metadata:", err);
        res.status(500).json({ error: "Failed to save metadata" });
    }
};

export const getGlobalMaterials = async (req: Request, res: Response) => {
    try {
        const { className, type } = req.body;

        const materials = await prisma.globalMaterial.findMany({
            where: {
                ...(className ? { className: String(className) } : {}),
                ...(type ? { type: String(type) } : {}),
            },
            orderBy: { uploadedAt: "desc" },
        });

        res.json({ success: true, data: materials });
    } catch (err) {
        console.error("Error fetching materials:", err);
        res.status(500).json({ error: "Failed to fetch materials" });
    }
};

export const deleteGlobalMaterial = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        const material = await prisma.globalMaterial.findUnique({ where: { id } });
        if (!material) return res.status(404).json({ error: "Material not found" });

        // Delete from GCS
        const objectPath = material.fileUrl.split(`/${process.env.GCP_BUCKET}/`)[1];
        await bucket.file(objectPath).delete({ ignoreNotFound: true });

        // Delete from DB
        await prisma.globalMaterial.delete({ where: { id } });

        res.json({ success: true, message: "Material deleted successfully" });
    } catch (err) {
        console.error("Error deleting material:", err);
        res.status(500).json({ error: "Failed to delete material" });
    }
};


export const getAllGlobalMaterials = async (req: Request, res: Response) => {
    try {
        const { className, type, page, limit } = req.body;

        const pageNumber = Number(page) || 1;
        const pageSize = Number(limit) || 20;
        const skip = (pageNumber - 1) * pageSize;

        // Build dynamic filter
        const where: any = {};
        if (className) where.className = String(className);
        if (type) where.type = String(type);

        // Fetch data with pagination
        const [materials, totalCount] = await Promise.all([
            prisma.globalMaterial.findMany({
                where,
                orderBy: { uploadedAt: "desc" },
                skip,
                take: pageSize,
            }),
            prisma.globalMaterial.count({ where }),
        ]);

        res.json({
            success: true,
            data: materials,
            pagination: {
                total: totalCount,
                page: pageNumber,
                pageSize,
                totalPages: Math.ceil(totalCount / pageSize),
            },
        });
    } catch (err) {
        console.error("Error fetching global materials:", err);
        res.status(500).json({ error: "Failed to fetch materials" });
    }
};

export const getGlobalMaterialsByClass = async (req: Request, res: Response) => {
    try {
        const { className } = req.body;

        if (!className) {
            return res.status(400).json({ error: "className is required" });
        }

        // Fetch all materials for that class
        const materials = await prisma.globalMaterial.findMany({
            where: { className: String(className) },
            orderBy: { uploadedAt: "desc" },
        });

        res.json({ success: true, data: materials });
    } catch (err) {
        console.error("Error fetching materials by class:", err);
        res.status(500).json({ error: "Failed to fetch materials" });
    }
};

// export const getGlobalMaterialsByClassAndType = async (req: Request, res: Response) => {
//     try {
//         const { className, type } = req.body;

//         if (!className || !type) {
//             return res.status(400).json({ error: "className and type are required" });
//         }

//         const materials = await prisma.globalMaterial.findMany({
//             where: {
//                 className: String(className),
//                 type: String(type),
//             },
//             orderBy: { uploadedAt: "desc" },
//         });

//         res.json({ success: true, data: materials });
//     } catch (err) {
//         console.error("Error fetching materials by class & type:", err);
//         res.status(500).json({ error: "Failed to fetch materials" });
//     }
// };

export const getGlobalMaterialsByClassAndType = async (req: Request, res: Response) => {
    try {
        const { className, type } = req.body;

        if (!className || !type) {
            return res.status(400).json({ error: "className and type are required" });
        }

        const materials = await prisma.globalMaterial.findMany({
            where: {
                className: String(className),
                type: String(type),
            },
            select: {
                fileUrl: true,  
            },
            orderBy: { uploadedAt: "desc" },
        });

        const fileUrls = materials.map(m => m.fileUrl);

        res.json({ success: true, data: fileUrls });
    } catch (err) {
        console.error("Error fetching materials by class & type:", err);
        res.status(500).json({ error: "Failed to fetch materials" });
    }
};





