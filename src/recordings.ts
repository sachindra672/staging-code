import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Storage } from '@google-cloud/storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from './misc';

import { Request, Response } from 'express';

if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error('AWS credentials are required');
}

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const storage = new Storage({
  keyFilename: process.env.GCP_KEYFILE_PATH,
  projectId: process.env.GCP_PROJECT_ID,
});

const bucketName = process.env.GCP_BUCKET as string;
const bucket = storage.bucket(bucketName);

export async function getSignedUrlAws(req: Request, res: Response) {
  const { fileName, fileType } = req.body;
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: fileName,
    ContentType: fileType,
  });

  try {
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 60 });
    res.json({ url: signedUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `Failed to generate URL: ${error}` });
  }
}

export async function getSignedUrlGcp(req: Request, res: Response) {
  const { fileName, fileType } = req.body;

  const file = bucket.file(fileName);

  try {
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 60 * 60 * 1000,
      contentType: fileType,
    });

    res.json({ url: signedUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `Failed to generate URL: ${error}` });
  }
}

export async function updateRecordingUrl(req: Request, res: Response) {
  const { sessionId, recordingUrl, recordingType } = req.body;

  if (!sessionId || !recordingUrl || !recordingType) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    let updateData: any = {};

    if (recordingType === 'host') {
      updateData.hostRecordingUrl = recordingUrl;
    } else if (recordingType === 'screen') {
      updateData.screenRecordingUrl = recordingUrl;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid recording type' });
    }

    await prisma.session.update({
      where: { id: Number(sessionId) },
      data: updateData,
    });

    return res.json({ success: true, message: 'Recording URL updated successfully' });
  } catch (error) {
    console.error('Error updating recording URL:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}