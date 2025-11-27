-- CreateEnum
CREATE TYPE "SubjectEnum" AS ENUM ('PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'MATHS', 'ENGLISH', 'CODING', 'ROBOTICS', 'BRAIN_DEVELOPMENT', 'MOTIVATIONAL_SESSION');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('FIL', 'PC', 'LTC', 'FOUNDATION', 'YT', 'OTHERS');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CONTENT_UPLOAD', 'CONTENT_PREVIEW', 'CONTENT_APPROVE', 'CONTENT_REJECT', 'ACCESS_REQUEST_CREATE', 'ACCESS_REQUEST_APPROVE', 'ACCESS_REQUEST_REJECT', 'APPROVER_ASSIGN', 'APPROVER_REASSIGN');

-- CreateTable
CREATE TABLE "Content" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "category" "Category" NOT NULL,
    "class" VARCHAR(5) NOT NULL,
    "subject" "SubjectEnum" NOT NULL,
    "s3Key" VARCHAR(500) NOT NULL,
    "uploadedBy" INTEGER NOT NULL,
    "approverId" INTEGER,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedOn" TIMESTAMP(3),

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAccess" (
    "id" SERIAL NOT NULL,
    "contentId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAccessRequest" (
    "id" SERIAL NOT NULL,
    "contentId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "reviewerId" INTEGER,
    "mentorId" INTEGER,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedOn" TIMESTAMP(3),

    CONSTRAINT "ContentAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApproverAssignment" (
    "id" SERIAL NOT NULL,
    "grade" VARCHAR(5) NOT NULL,
    "subject" "SubjectEnum" NOT NULL,
    "mentorId" INTEGER NOT NULL,

    CONSTRAINT "ApproverAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "action" "AuditAction" NOT NULL,
    "note" VARCHAR(1000),
    "meta" JSONB,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorMentorId" INTEGER,
    "actorAdminId" INTEGER,
    "contentId" INTEGER,
    "accessRequestId" INTEGER,
    "approverAssignmentId" INTEGER,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentAccess_contentId_mentorId_key" ON "ContentAccess"("contentId", "mentorId");

-- CreateIndex
CREATE INDEX "ContentAccessRequest_status_idx" ON "ContentAccessRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApproverAssignment_grade_subject_key" ON "ApproverAssignment"("grade", "subject");

-- CreateIndex
CREATE INDEX "AuditLog_createdOn_idx" ON "AuditLog"("createdOn");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_contentId_idx" ON "AuditLog"("contentId");

-- CreateIndex
CREATE INDEX "AuditLog_accessRequestId_idx" ON "AuditLog"("accessRequestId");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "mentor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAccess" ADD CONSTRAINT "ContentAccess_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAccess" ADD CONSTRAINT "ContentAccess_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAccessRequest" ADD CONSTRAINT "ContentAccessRequest_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAccessRequest" ADD CONSTRAINT "ContentAccessRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAccessRequest" ADD CONSTRAINT "ContentAccessRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAccessRequest" ADD CONSTRAINT "ContentAccessRequest_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApproverAssignment" ADD CONSTRAINT "ApproverAssignment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorMentorId_fkey" FOREIGN KEY ("actorMentorId") REFERENCES "mentor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "ContentAccessRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_approverAssignmentId_fkey" FOREIGN KEY ("approverAssignmentId") REFERENCES "ApproverAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
