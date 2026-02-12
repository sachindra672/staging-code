-- CreateTable
CREATE TABLE "BlogAdBanner" (
    "id" TEXT NOT NULL,
    "imageLink" TEXT NOT NULL,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogAdBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePageBanner" (
    "id" TEXT NOT NULL,
    "imageLink" TEXT NOT NULL,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoursePageBanner_pkey" PRIMARY KEY ("id")
);
