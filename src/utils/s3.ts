import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import crypto from "crypto";

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

export async function getPreviewUrl(s3Key: string, expiresSeconds = 86400) {
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: s3Key,
        ResponseContentDisposition: "inline", 
    });

    return await getSignedUrl(s3, command, { expiresIn: expiresSeconds });
}


export async function uploadToS3AndReturnKey(
    file: Express.Multer.File,
    mentorId: string,
    classLevel: string,
    subject: string
): Promise<string> {
    if (!file) {
        throw new Error("No file provided");
    }

    // Generate a unique filename
    const ext = path.extname(file.originalname);
    const randomName = crypto.randomBytes(16).toString("hex") + ext;

    // Define key structure (organized by mentor/class/subject)
    const key = `content/${mentorId}/class-${classLevel}/subject-${subject}/${randomName}`;

    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        Body: file.buffer, 
        ContentType: file.mimetype,
    });

    await s3.send(command);

    return key; 
}