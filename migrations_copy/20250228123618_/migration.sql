-- AlterTable
ALTER TABLE "RegterationLeads" ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "status" TEXT,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;
