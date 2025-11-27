-- CreateTable
CREATE TABLE "classCardWeb" (
    "id" SERIAL NOT NULL,
    "educatorImage" TEXT NOT NULL,
    "demoPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classCardWeb_pkey" PRIMARY KEY ("id")
);
