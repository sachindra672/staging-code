-- CreateEnum
CREATE TYPE "CTestMode" AS ENUM ('MCQ', 'IMAGE');

-- CreateEnum
CREATE TYPE "CTestSubmissionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED');

-- AlterTable
ALTER TABLE "ctest" ADD COLUMN     "mode" "CTestMode" NOT NULL DEFAULT 'MCQ',
ADD COLUMN     "totalMarks" INTEGER;

-- AlterTable
ALTER TABLE "ctestSubmission" ADD COLUMN     "awardedMarks" INTEGER,
ADD COLUMN     "gradedAt" TIMESTAMP(3),
ADD COLUMN     "gradedBy" INTEGER,
ADD COLUMN     "gradingNote" TEXT,
ADD COLUMN     "status" "CTestSubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "totalMarks" INTEGER;

-- CreateTable
CREATE TABLE "ctestImageQuestion" (
    "id" SERIAL NOT NULL,
    "ctestId" INTEGER NOT NULL,
    "prompt" TEXT,
    "instructions" TEXT,
    "questionImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxMarks" INTEGER NOT NULL,
    "maxAnswerImages" INTEGER NOT NULL DEFAULT 5,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ctestImageQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctestImageAnswer" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "answerImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "awardedMarks" INTEGER,
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ctestImageAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ctestImageAnswer_submissionId_idx" ON "ctestImageAnswer"("submissionId");

-- CreateIndex
CREATE INDEX "ctestImageAnswer_questionId_idx" ON "ctestImageAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ctestImageAnswer_submissionId_questionId_key" ON "ctestImageAnswer"("submissionId", "questionId");

-- AddForeignKey
ALTER TABLE "ctestImageQuestion" ADD CONSTRAINT "ctestImageQuestion_ctestId_fkey" FOREIGN KEY ("ctestId") REFERENCES "ctest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctestImageAnswer" ADD CONSTRAINT "ctestImageAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ctestSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctestImageAnswer" ADD CONSTRAINT "ctestImageAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ctestImageQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
