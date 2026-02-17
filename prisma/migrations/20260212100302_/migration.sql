-- AlterTable
ALTER TABLE "mgSubsciption" ADD COLUMN     "bigCourseBundleId" INTEGER,
ADD COLUMN     "isFullCourse" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "BigCourseBundle" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "bigCourseId" INTEGER NOT NULL,
    "subjectIds" INTEGER[],
    "price" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "playStoreId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BigCourseBundle_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BigCourseBundle" ADD CONSTRAINT "BigCourseBundle_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mgSubsciption" ADD CONSTRAINT "mgSubsciption_bigCourseBundleId_fkey" FOREIGN KEY ("bigCourseBundleId") REFERENCES "BigCourseBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
