-- CreateTable
CREATE TABLE "doubtSlot" (
    "id" SERIAL NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "dayOfWeek" VARCHAR(20) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "maxCapacity" INTEGER NOT NULL DEFAULT 1,
    "currentBookings" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doubtSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubtSlotBooking" (
    "id" SERIAL NOT NULL,
    "slotId" INTEGER NOT NULL,
    "doubtId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "completedOn" TIMESTAMP(3),
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doubtSlotBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doubtSlot_mentorId_idx" ON "doubtSlot"("mentorId");

-- CreateIndex
CREATE INDEX "doubtSlot_isAvailable_idx" ON "doubtSlot"("isAvailable");

-- CreateIndex
CREATE INDEX "doubtSlotBooking_slotId_idx" ON "doubtSlotBooking"("slotId");

-- CreateIndex
CREATE INDEX "doubtSlotBooking_doubtId_idx" ON "doubtSlotBooking"("doubtId");

-- CreateIndex
CREATE INDEX "doubtSlotBooking_mentorId_idx" ON "doubtSlotBooking"("mentorId");

-- CreateIndex
CREATE INDEX "doubtSlotBooking_studentId_idx" ON "doubtSlotBooking"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "doubtSlotBooking_doubtId_key" ON "doubtSlotBooking"("doubtId");

-- AddForeignKey
ALTER TABLE "doubtSlot" ADD CONSTRAINT "doubtSlot_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubtSlotBooking" ADD CONSTRAINT "doubtSlotBooking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "doubtSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubtSlotBooking" ADD CONSTRAINT "doubtSlotBooking_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "doubt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubtSlotBooking" ADD CONSTRAINT "doubtSlotBooking_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubtSlotBooking" ADD CONSTRAINT "doubtSlotBooking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
