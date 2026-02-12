-- CreateTable
CREATE TABLE "WebLinks" (
    "id" TEXT NOT NULL,
    "laptopVideoLink" TEXT NOT NULL,
    "webBannerImageLink" TEXT NOT NULL,

    CONSTRAINT "WebLinks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestimonialReel" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "TestimonialReel_pkey" PRIMARY KEY ("id")
);
