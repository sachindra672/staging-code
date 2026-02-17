import { Storage } from "@google-cloud/storage";
import { prisma } from "../misc";
import { MaterialSource } from "@prisma/client";

const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GCP_KEYFILE_PATH,
});

const bucket = storage.bucket(process.env.GCP_BUCKET!);

export const uploadMaterialToGCS = async (
    base64Data: string,
    fileName: string,
    bigCourseId: number,
    sessionId?: number,
    source: MaterialSource = MaterialSource.NEW
) => {
    // Convert base64 to buffer
    const base64Content = base64Data.split(';base64,').pop();
    if (!base64Content) throw new Error("Invalid base64 data");
    const buffer = Buffer.from(base64Content, 'base64');

    // MIME type extraction
    const mimeMatch = base64Data.match(/^data:(.*);base64,/);
    const contentType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

    const safeName = fileName.replace(/\s+/g, "_");
    const folderPath = `course_materials_staging/${bigCourseId}/${sessionId || 'general'}`;
    const gcsPath = `${folderPath}/${Date.now()}_${safeName}`;

    const blob = bucket.file(gcsPath);
    const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: contentType,
    });

    const fileUrl = await new Promise<string>((resolve, reject) => {
        blobStream.on("finish", async () => {
            try {
                await blob.makePublic();
                resolve(`https://storage.googleapis.com/${bucket.name}/${gcsPath}`);
            } catch (err) {
                reject(err);
            }
        });
        blobStream.on("error", (err) => reject(err));
        blobStream.end(buffer);
    });

    // Create DB record ONLY
    const material = await prisma.courseMaterial.create({
        data: {
            fileName,
            fileUrl,
            bigCourseId,
            sessionId,
            source,
            storageType: "GCS"
        }
    });

    return material;
};
