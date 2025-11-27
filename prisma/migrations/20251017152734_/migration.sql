-- CreateTable
CREATE TABLE "TestimonialCard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "grade" TEXT,
    "profileImage" TEXT,
    "content" TEXT NOT NULL,
    "studentName" TEXT,
    "courseEnrolled" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestimonialCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultyMemberWebCard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "qualification" TEXT,
    "experienceText" TEXT,
    "experienceYears" INTEGER,
    "imageUrl" TEXT,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacultyMemberWebCard_pkey" PRIMARY KEY ("id")
);
