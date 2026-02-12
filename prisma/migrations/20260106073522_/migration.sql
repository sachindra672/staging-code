-- AlterTable
ALTER TABLE "doubtPackagePurchases" ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "doubtSlotBooking" ADD COLUMN     "instanceId" INTEGER,
ALTER COLUMN "slotId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "doubtSlotInstance" (
    "id" SERIAL NOT NULL,
    "slotId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "maxCapacity" INTEGER NOT NULL DEFAULT 1,
    "currentBookings" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doubtSlotInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doubtSlotInstance_slotId_idx" ON "doubtSlotInstance"("slotId");

-- CreateIndex
CREATE INDEX "doubtSlotInstance_mentorId_idx" ON "doubtSlotInstance"("mentorId");

-- CreateIndex
CREATE INDEX "doubtSlotInstance_isAvailable_idx" ON "doubtSlotInstance"("isAvailable");

-- CreateIndex
CREATE INDEX "doubtSlotInstance_startTime_idx" ON "doubtSlotInstance"("startTime");

-- AddForeignKey
ALTER TABLE "doubtSlotInstance" ADD CONSTRAINT "doubtSlotInstance_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "doubtSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubtSlotInstance" ADD CONSTRAINT "doubtSlotInstance_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubtSlotBooking" ADD CONSTRAINT "doubtSlotBooking_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "doubtSlotInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
