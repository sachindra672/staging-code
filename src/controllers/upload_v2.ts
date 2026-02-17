import { Request, Response } from "express";
import { uploadMaterialToGCS } from "../utils/materialStorage";
import { prisma } from "../misc";
import { MaterialSource } from "@prisma/client";

interface FileData {
    fileData: string;
    fileName: string;
}

export async function UploadCourseMaterialsV2(req: Request, res: Response) {
    const { bigCourseId, sessionId } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0 || !bigCourseId) {
        return res.status(400).send("Missing required fields: fileData or bigCourseId");
    }

    try {
        const bId = parseInt(bigCourseId);
        const sId = sessionId ? parseInt(sessionId) : undefined;

        if (isNaN(bId)) {
            return res.status(400).send("Invalid bigCourseId");
        }

        let sessionName: string | undefined;
        let startingPartNumber = 1;

        if (sId) {
            const existingMaterials = await prisma.courseMaterial.findMany({
                where: {
                    bigCourseId: bId,
                    sessionId: sId
                },
                select: { fileName: true }
            });

            if (existingMaterials.length > 0) {
                const firstFile = existingMaterials[0].fileName;

                const match = firstFile.match(/^(.*)-part\d+\./);
                if (match) {
                    sessionName = match[1];
                }

                let maxPart = 0;
                existingMaterials.forEach(mat => {
                    const partMatch = mat.fileName.match(/-part(\d+)\./);
                    if (partMatch) {
                        const num = parseInt(partMatch[1]);
                        if (num > maxPart) maxPart = num;
                    }
                });

                startingPartNumber = maxPart + 1;

            } else {
                const session = await prisma.session.findUnique({
                    where: { id: sId },
                    select: { detail: true }
                });

                if (!session) {
                    return res.status(404).send("Session not found");
                }

                sessionName = session.detail
                    .trim()
                    .replace(/[^a-zA-Z0-9\s-_]/g, "")
                    .replace(/\s+/g, " ");
            }
        }

        const uploadPromises = files.map((file, index) => {
            const base64Data = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

            let fileName = file.originalname;

            if (sessionName) {
                const ext = file.originalname.split(".").pop();
                const partNumber = startingPartNumber + index;
                fileName = `${sessionName}-part${partNumber}.${ext}`;
            }

            return uploadMaterialToGCS(
                base64Data,
                fileName,
                bId,
                sId,
                MaterialSource.NEW
            );
        });

        const results = await Promise.all(uploadPromises);

        res.status(200).json({
            success: true,
            message: "Files uploaded successfully to GCS and tracked in DB",
            data: results
        });

    } catch (error) {
        console.error("Error in UploadCourseMaterialsV2:", error);

        if (error instanceof Error) {
            res.status(400).send(error.message);
        } else {
            res.status(500).send("Internal server error");
        }
    }
}

export async function GetCourseMaterialsV2(req: Request, res: Response) {
    const { bigCourseId, sessionId } = req.body;

    if (!bigCourseId && !sessionId) {
        return res.status(400).send('Missing required parameter: bigCourseId or sessionId');
    }

    try {
        const whereClause: any = {};
        if (bigCourseId) whereClause.bigCourseId = parseInt(bigCourseId);
        if (sessionId) whereClause.sessionId = parseInt(sessionId);

        const materials = await prisma.courseMaterial.findMany({
            where: whereClause,
            orderBy: { createdOn: 'desc' },
            include: {
                session: {
                    select: {
                        detail: true,
                        startTime: true
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            data: materials
        });
    } catch (error) {
        console.error('Error in GetCourseMaterialsV2:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}
