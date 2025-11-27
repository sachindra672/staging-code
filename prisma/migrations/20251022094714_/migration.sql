-- AlterTable
ALTER TABLE "BigCourse" ADD COLUMN     "isWebCreated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BigCourseWeb" (
    "id" SERIAL NOT NULL,
    "bigCourseId" INTEGER NOT NULL,
    "createdWeb" BOOLEAN NOT NULL DEFAULT true,
    "courseDemoPrice" DOUBLE PRECISION,
    "webLabel" TEXT,
    "courseVideoLink" TEXT,
    "promoteCourses" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BigCourseWeb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectWeb" (
    "id" SERIAL NOT NULL,
    "bigCourseWebId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "taglinePoints" TEXT[],

    CONSTRAINT "SubjectWeb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterWeb" (
    "id" SERIAL NOT NULL,
    "subjectWebId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "syllabusPoints" TEXT[],

    CONSTRAINT "ChapterWeb_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BigCourseWeb_bigCourseId_key" ON "BigCourseWeb"("bigCourseId");

-- AddForeignKey
ALTER TABLE "BigCourseWeb" ADD CONSTRAINT "BigCourseWeb_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectWeb" ADD CONSTRAINT "SubjectWeb_bigCourseWebId_fkey" FOREIGN KEY ("bigCourseWebId") REFERENCES "BigCourseWeb"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterWeb" ADD CONSTRAINT "ChapterWeb_subjectWebId_fkey" FOREIGN KEY ("subjectWebId") REFERENCES "SubjectWeb"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
