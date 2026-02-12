-- CreateTable
CREATE TABLE "doubtLead" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "class" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "doubtPackageId" INTEGER,
    "status" TEXT NOT NULL,
    "times" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(10,2),
    "source" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doubtLead_pkey" PRIMARY KEY ("id")
);
