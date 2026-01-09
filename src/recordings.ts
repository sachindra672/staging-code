import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Storage } from '@google-cloud/storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from './misc';
import { grantTaskReward } from './sisyacoin/taskRewardController';
import { Decimal } from '@prisma/client/runtime/library';
import { getSystemWallet } from './config/sisyacoinHelperFunctions';

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

// Track recording watch/play and give reward
export async function markRecordingAsWatched(req: Request, res: Response) {
  try {
    const { userId, contentType, contentId, totalDuration } = req.body;

    if (!userId || !contentType || !contentId) {
      return res.status(400).json({
        success: false,
        message: 'userId, contentType, and contentId are required'
      });
    }

    const endUsersId = typeof userId === 'number' ? userId : parseInt(userId);
    if (isNaN(endUsersId) || endUsersId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    // Find or create watch progress record
    const existingProgress = await prisma.recordingWatchProgress.findUnique({
      where: {
        endUsersId_contentType_contentId: {
          endUsersId,
          contentType: contentType.toString(),
          contentId: contentId.toString(),
        },
      },
    });

    let watchProgress;
    let rewardInfo: any = null;

    if (existingProgress) {
      // Update if not already marked as played
      if (!existingProgress.hasPlayed) {
        watchProgress = await prisma.recordingWatchProgress.update({
          where: { id: existingProgress.id },
          data: {
            hasPlayed: true,
            firstPlayedAt: new Date(),
            lastPlayedAt: new Date(),
            totalDuration: totalDuration ? parseInt(totalDuration) : existingProgress.totalDuration,
          },
        });
      } else {
        // Already played, just update lastPlayedAt
        watchProgress = await prisma.recordingWatchProgress.update({
          where: { id: existingProgress.id },
          data: {
            lastPlayedAt: new Date(),
            totalDuration: totalDuration ? parseInt(totalDuration) : existingProgress.totalDuration,
          },
        });
      }
    } else {
      // Create new watch progress record
      watchProgress = await prisma.recordingWatchProgress.create({
        data: {
          endUsersId,
          contentType: contentType.toString(),
          contentId: contentId.toString(),
          hasPlayed: true,
          firstPlayedAt: new Date(),
          lastPlayedAt: new Date(),
          totalDuration: totalDuration ? parseInt(totalDuration) : 0,
        },
      });
    }

    // Give reward if not already given
    if (!watchProgress.rewardGiven) {
      try {
        const rewardAmount = 10;
        const taskCode = `RECORDING_WATCH_${contentType}_${contentId}_${endUsersId}`;
        const amountDecimal = new Decimal(rewardAmount);
        const reason = `Recording watch reward - ${contentType} ${contentId}`;

        const systemWallet = await getSystemWallet();
        if (systemWallet.spendableBalance.lt(amountDecimal)) {
          console.warn(
            `System wallet has insufficient balance for recording watch reward. Available: ${systemWallet.spendableBalance}, Required: ${rewardAmount}`
          );
          rewardInfo = {
            coinsEarned: 0,
            message: "System wallet has insufficient balance",
            breakdown: {
              reward: rewardAmount,
            },
          };
        } else {
          const rewardReq = {
            body: {
              userId: endUsersId,
              taskCode: taskCode,
              coinsAmount: rewardAmount,
              reason: reason,
              metadata: {
                contentType: contentType.toString(),
                contentId: contentId.toString(),
                type: "RECORDING_WATCH",
              },
            },
          } as Request;

          let rewardResponseData: any = null;
          const rewardRes = {
            json: (data: any) => {
              rewardResponseData = data;
            },
            status: (_code: number) => ({
              json: (data: any) => {
                rewardResponseData = data;
              },
            }),
          } as unknown as Response;

          await grantTaskReward(rewardReq, rewardRes);

          if (rewardResponseData?.success) {
            // Update watch progress to mark reward as given
            await prisma.recordingWatchProgress.update({
              where: { id: watchProgress.id },
              data: {
                rewardGiven: true,
                rewardGivenAt: new Date(),
              },
            });

            rewardInfo = {
              coinsEarned: rewardAmount,
              message: `Watch reward: ${rewardAmount} coins`,
              breakdown: {
                reward: rewardAmount,
              },
              userWallet: rewardResponseData.data?.userWallet || null,
              reward: {
                reward: rewardResponseData.data?.reward || null,
                transactions: rewardResponseData.data?.transactions || null,
              },
            };
          } else {
            rewardInfo = {
              coinsEarned: 0,
              message: "Reward grant failed",
              breakdown: {
                reward: rewardAmount,
              },
            };
          }
        }
      } catch (rewardError) {
        console.error('Error in reward granting logic:', rewardError);
        rewardInfo = {
          coinsEarned: 0,
          message: "Error processing reward",
          error: rewardError instanceof Error ? rewardError.message : "Unknown error",
        };
      }
    } else {
      rewardInfo = {
        coinsEarned: 0,
        message: "Reward already given for this recording",
        alreadyRewarded: true,
      };
    }

    // Fetch updated progress to include reward status
    const updatedProgress = await prisma.recordingWatchProgress.findUnique({
      where: { id: watchProgress.id },
    });

    return res.status(200).json({
      success: true,
      data: {
        watchProgress: updatedProgress,
        reward: rewardInfo,
      },
    });
  } catch (error) {
    console.error('Error marking recording as watched:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}