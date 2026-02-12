-- CreateTable
CREATE TABLE "scheduledNotification" (
    "id" BIGSERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "userType" INTEGER NOT NULL,
    "targetId" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduledNotification_pkey" PRIMARY KEY ("id")
);
