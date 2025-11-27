-- DropForeignKey
ALTER TABLE "qtest" DROP CONSTRAINT "qtest_subjectId_fkey";

-- AlterTable
ALTER TABLE "qtest" ADD COLUMN     "sessionId" INTEGER,
ALTER COLUMN "subjectId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "qtest" ADD CONSTRAINT "qtest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qtest" ADD CONSTRAINT "qtest_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
