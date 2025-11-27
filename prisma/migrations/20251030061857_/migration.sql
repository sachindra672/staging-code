-- CreateTable
CREATE TABLE "GlobalMaterial" (
    "id" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "size" INTEGER,
    "mimeType" TEXT,

    CONSTRAINT "GlobalMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GlobalMaterial_className_idx" ON "GlobalMaterial"("className");

-- CreateIndex
CREATE INDEX "GlobalMaterial_type_idx" ON "GlobalMaterial"("type");
