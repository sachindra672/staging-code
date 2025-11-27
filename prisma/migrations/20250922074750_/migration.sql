-- /*
--   Warnings:

--   - The `deviceType` column on the `endUsers` table would be dropped and recreated. This will lead to data loss if there is data in the column.

-- */
-- -- CreateEnum
-- CREATE TYPE "DeviceType" AS ENUM ('ANDROID', 'IOS');

-- -- AlterTable
-- ALTER TABLE "RegterationLeads" ADD COLUMN     "alternatePhone" TEXT,
-- ADD COLUMN     "preffredLanguage" TEXT;

-- -- AlterTable
-- ALTER TABLE "endUsers" DROP COLUMN "deviceType",
-- ADD COLUMN     "deviceType" "DeviceType" DEFAULT 'ANDROID';

-- -- CreateTable
-- CREATE TABLE "SessionReminder" (
--     "id" SERIAL NOT NULL,
--     "sessionId" INTEGER NOT NULL,
--     "studentId" INTEGER NOT NULL,
--     "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     "attempt" INTEGER NOT NULL DEFAULT 1,

--     CONSTRAINT "SessionReminder_pkey" PRIMARY KEY ("id")
-- );

-- -- CreateTable
-- CREATE TABLE "PreSessionReminder" (
--     "id" SERIAL NOT NULL,
--     "sessionId" INTEGER NOT NULL,
--     "studentId" INTEGER NOT NULL,
--     "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     "type" TEXT NOT NULL,

--     CONSTRAINT "PreSessionReminder_pkey" PRIMARY KEY ("id")
-- );

-- -- CreateIndex
-- CREATE UNIQUE INDEX "SessionReminder_sessionId_studentId_key" ON "SessionReminder"("sessionId", "studentId");

-- -- CreateIndex
-- CREATE UNIQUE INDEX "PreSessionReminder_sessionId_studentId_type_key" ON "PreSessionReminder"("sessionId", "studentId", "type");

-- -- AddForeignKey
-- ALTER TABLE "PreSessionReminder" ADD CONSTRAINT "PreSessionReminder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- -- AddForeignKey
-- ALTER TABLE "PreSessionReminder" ADD CONSTRAINT "PreSessionReminder_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
