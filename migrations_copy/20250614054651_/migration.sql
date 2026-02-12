-- AlterTable
ALTER TABLE "session" ADD COLUMN     "screenRecordingTimeStamp" JSONB,
ADD COLUMN     "sessionStartTime" TIMESTAMP(3);
