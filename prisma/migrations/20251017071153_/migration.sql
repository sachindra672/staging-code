-- CreateTable
CREATE TABLE "FeatureShowcaseSection" (
    "id" TEXT NOT NULL,
    "headingTop" TEXT NOT NULL,
    "headingMain" TEXT NOT NULL,
    "headingMainStyled" JSONB,
    "title" TEXT NOT NULL,
    "titleStyled" JSONB,
    "subtitle" TEXT NOT NULL,
    "background" TEXT,
    "order" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureShowcaseSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureShowcaseFeature" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER,

    CONSTRAINT "FeatureShowcaseFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureShowcaseImage" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "position" TEXT,
    "order" INTEGER,

    CONSTRAINT "FeatureShowcaseImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FeatureShowcaseFeature" ADD CONSTRAINT "FeatureShowcaseFeature_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "FeatureShowcaseSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureShowcaseImage" ADD CONSTRAINT "FeatureShowcaseImage_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "FeatureShowcaseSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
