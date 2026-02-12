-- AlterTable
ALTER TABLE "blogs" ADD COLUMN     "publishStatus" TEXT NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN     "scheduledAt" TIMESTAMP(3);
