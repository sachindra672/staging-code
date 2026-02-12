/*
  Warnings:

  - The `deviceType` column on the `endUsers` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('ANDROID', 'IOS');

-- AlterTable
ALTER TABLE "endUsers" DROP COLUMN "deviceType",
ADD COLUMN     "deviceType" "DeviceType" DEFAULT 'ANDROID';
