-- CreateEnum
CREATE TYPE "AnnouncmentType" AS ENUM ('GENERAL', 'IMPORTANT', 'ALERT', 'REMINDER');

-- CreateEnum
CREATE TYPE "AnnouncmentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnnouncmentAudience" AS ENUM ('ALL_USERS', 'STUDENTS', 'TEACHERS');

-- CreateEnum
CREATE TYPE "AnnouncmentScope" AS ENUM ('GLOBAL', 'COURSE', 'CLASS', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "AnnouncmentSource" AS ENUM ('ADMIN', 'TEACHER', 'SYSTEM');

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "AnnouncmentType" NOT NULL DEFAULT 'GENERAL',
    "status" "AnnouncmentStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" "AnnouncmentAudience" NOT NULL DEFAULT 'ALL_USERS',
    "scope" "AnnouncmentScope" NOT NULL DEFAULT 'GLOBAL',
    "courseId" INTEGER,
    "classId" INTEGER,
    "userId" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sendPush" BOOLEAN NOT NULL DEFAULT true,
    "sendEmail" BOOLEAN NOT NULL DEFAULT false,
    "sendWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "sendSMS" BOOLEAN NOT NULL DEFAULT false,
    "sendInApp" BOOLEAN NOT NULL DEFAULT true,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalRead" INTEGER NOT NULL DEFAULT 0,
    "source" "AnnouncmentSource" NOT NULL DEFAULT 'ADMIN',
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_status_idx" ON "Announcement"("status");

-- CreateIndex
CREATE INDEX "Announcement_scheduledAt_idx" ON "Announcement"("scheduledAt");

-- CreateIndex
CREATE INDEX "Announcement_audience_scope_idx" ON "Announcement"("audience", "scope");

-- CreateIndex
CREATE INDEX "AnnouncementRead_userId_idx" ON "AnnouncementRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "endUsers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "BigCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "endUsers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
