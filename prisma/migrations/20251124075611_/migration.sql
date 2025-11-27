-- CreateTable
CREATE TABLE "SipMentor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institute" TEXT,
    "imageLink" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SipMentor_pkey" PRIMARY KEY ("id")
);
