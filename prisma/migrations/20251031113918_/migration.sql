-- CreateTable
CREATE TABLE "WebBanner" (
    "id" TEXT NOT NULL,
    "imageLink" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebVideo" (
    "id" TEXT NOT NULL,
    "videoLink" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebVideo_pkey" PRIMARY KEY ("id")
);
