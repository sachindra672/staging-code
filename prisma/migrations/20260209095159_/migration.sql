-- AlterTable
ALTER TABLE "endUsers" ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BanRecord" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "bannedByMentorId" INTEGER,
    "bannedByAdminId" INTEGER,
    "unbannedByAdminId" INTEGER,
    "reason" TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unbannedAt" TIMESTAMP(3),

    CONSTRAINT "BanRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BanRecord" ADD CONSTRAINT "BanRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanRecord" ADD CONSTRAINT "BanRecord_bannedByMentorId_fkey" FOREIGN KEY ("bannedByMentorId") REFERENCES "mentor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanRecord" ADD CONSTRAINT "BanRecord_bannedByAdminId_fkey" FOREIGN KEY ("bannedByAdminId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanRecord" ADD CONSTRAINT "BanRecord_unbannedByAdminId_fkey" FOREIGN KEY ("unbannedByAdminId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
