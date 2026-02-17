-- CreateEnum
CREATE TYPE "MaterialSource" AS ENUM ('NEW', 'LEGACY');

-- CreateTable
CREATE TABLE "CourseMaterial" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "bigCourseId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "storageType" TEXT NOT NULL DEFAULT 'GCS',
    "source" "MaterialSource" NOT NULL DEFAULT 'NEW',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseMaterial_bigCourseId_idx" ON "CourseMaterial"("bigCourseId");

-- CreateIndex
CREATE INDEX "CourseMaterial_sessionId_idx" ON "CourseMaterial"("sessionId");

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMaterial" ADD CONSTRAINT "CourseMaterial_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
