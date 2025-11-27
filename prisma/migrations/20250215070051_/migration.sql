-- CreateTable
CREATE TABLE "RegterationLeads" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "class" TEXT NOT NULL,

    CONSTRAINT "RegterationLeads_pkey" PRIMARY KEY ("id")
);
