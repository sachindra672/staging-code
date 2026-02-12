-- CreateTable
CREATE TABLE "sipCraousel1" (
    "id" TEXT NOT NULL,
    "imageLink" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sipCraousel1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sipCraousel2" (
    "id" TEXT NOT NULL,
    "imageLink" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sipCraousel2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SipAppointmentLead" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'IN',
    "mobileNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "institute" TEXT,
    "location" TEXT,
    "preferredBoard" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SipAppointmentLead_pkey" PRIMARY KEY ("id")
);
