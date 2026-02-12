import { Request, Response } from 'express';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutBucketCorsCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

async function configureBucketCors() {
  const s3Client = getS3Client('eu-north-1');

  const command = new PutBucketCorsCommand({
    Bucket: 'sisyaclassrecordings',
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedHeaders: ['*'],
          AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
          AllowedOrigins: ['http://localhost:5173', 'https://portal.sisyaclass.com'],
          ExposeHeaders: ['ETag', 'x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  });

  await s3Client.send(command);
  console.log('CORS configuration updated successfully');
}

function getS3Client(region: string): S3Client {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials are not configured');
  }

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

export async function initS3upload(req: Request, res: Response) {
  try {
    const { fileName, contentType, bucketName, region } = req.body;
    const s3Client = getS3Client(region);

    const command = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: fileName,
      ContentType: contentType,
      Metadata: {
        'origin': req.headers.origin || 'http://localhost:5173'
      }
      // ACL: 'public-read' // Make the file publicly accessible
    });

    const response = await s3Client.send(command);

    res.json({
      success: true,
      uploadId: response.UploadId
    });
  } catch (error) {
    console.error('Error initiating multipart upload:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
}

export async function getS3uploadUrl(req: Request, res: Response) {
  try {
    const { fileName, uploadId, partNumber, bucketName, region, checksumCRC32 } = req.body;
    const s3Client = getS3Client(region);

    const command = new UploadPartCommand({
      Bucket: bucketName,
      Key: fileName,
      UploadId: uploadId,
      PartNumber: partNumber,
      ChecksumCRC32: checksumCRC32,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.json({
      success: true,
      presignedUrl
    });
  } catch (error) {
    console.error('Error getting presigned URL:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
}

export async function completeS3upload(req: Request, res: Response) {
  try {
    const { fileName, uploadId, parts, bucketName, region } = req.body;
    const s3Client = getS3Client(region);

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: fileName,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
      }
    });

    await s3Client.send(command);

    const publicUrl = `https://s3.${region}.amazonaws.com/${bucketName}/${fileName}`;

    res.json({
      success: true,
      fileUrl: publicUrl
    });
  } catch (error) {
    console.error('Error completing multipart upload:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
}

export async function abortS3upload(req: Request, res: Response) {
  try {
    const { fileName, uploadId, bucketName, region } = req.body;
    const s3Client = getS3Client(region);

    const command = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: fileName,
      UploadId: uploadId
    });

    await s3Client.send(command);

    res.json({
      success: true,
      message: 'Upload aborted successfully'
    });
  } catch (error) {
    console.error('Error aborting multipart upload:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
}