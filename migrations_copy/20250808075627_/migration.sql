-- AlterTable
ALTER TABLE "scheduledNotification" ADD COLUMN     "recipientDetails" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "recipientType" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'Untitled',
ADD COLUMN     "tokens" JSONB NOT NULL DEFAULT '[]';
