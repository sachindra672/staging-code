-- AlterEnum
ALTER TYPE "qtype" ADD VALUE 'subjective';

-- AlterTable
ALTER TABLE "cTestResponse" ADD COLUMN     "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "subjectiveAnswer" TEXT,
ALTER COLUMN "response" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ctestQuestions" ADD COLUMN     "allowAttachments" BOOLEAN DEFAULT false,
ADD COLUMN     "isSubjective" BOOLEAN DEFAULT false,
ADD COLUMN     "maxWords" INTEGER,
ALTER COLUMN "option1" DROP NOT NULL,
ALTER COLUMN "option2" DROP NOT NULL;
