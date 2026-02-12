-- AlterTable
ALTER TABLE "BigCourse" ADD COLUMN     "partialPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "mgSubsciption" ADD COLUMN     "isPartialPaid" BOOLEAN NOT NULL DEFAULT false;
