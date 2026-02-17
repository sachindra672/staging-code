-- DropForeignKey
ALTER TABLE "ctest" DROP CONSTRAINT "ctest_subjectId_fkey";

-- AlterTable
ALTER TABLE "ctest" ALTER COLUMN "Duration" DROP NOT NULL,
ALTER COLUMN "subjectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ctestImageQuestion" ADD COLUMN     "sectionId" INTEGER;

-- AlterTable
ALTER TABLE "ctestQuestions" ADD COLUMN     "sectionId" INTEGER;

-- CreateTable
CREATE TABLE "CTestSection" (
    "id" SERIAL NOT NULL,
    "ctestId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "title" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CTestSection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ctest" ADD CONSTRAINT "ctest_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CTestSection" ADD CONSTRAINT "CTestSection_ctestId_fkey" FOREIGN KEY ("ctestId") REFERENCES "ctest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CTestSection" ADD CONSTRAINT "CTestSection_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctestQuestions" ADD CONSTRAINT "ctestQuestions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CTestSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctestImageQuestion" ADD CONSTRAINT "ctestImageQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CTestSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
