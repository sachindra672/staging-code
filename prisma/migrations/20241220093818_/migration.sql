-- CreateEnum
CREATE TYPE "qtype" AS ENUM ('multipleChoice', 'trueFalse');

-- CreateTable
CREATE TABLE "endUsers" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" VARCHAR(255),
    "email" VARCHAR(255),
    "address" VARCHAR(255),
    "phone" VARCHAR(13),
    "grade" TEXT,
    "password" VARCHAR(255),
    "isVerified" BOOLEAN DEFAULT false,
    "createdOn" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "modefiedOn" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "image" TEXT,
    "board" TEXT NOT NULL DEFAULT 'cbse',
    "deviceId" TEXT NOT NULL DEFAULT '',
    "educationBoardId" INTEGER DEFAULT 1,
    "parentId" INTEGER,
    "parentName" TEXT,
    "parentDeviceIds" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "groupChatInfoId" INTEGER,

    CONSTRAINT "endUsers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "searchTags" VARCHAR(255) NOT NULL,
    "languages" VARCHAR(255) NOT NULL,
    "passHash" TEXT NOT NULL DEFAULT '$argon2id$v=19$m=16,t=2,p=1$REduaEZXVVJVT3JsaExXdw$JS29/SYbeBmHj8P0mjvEvQ',
    "about" TEXT NOT NULL DEFAULT 'this is some random about value to prevent null error ',
    "Grades" TEXT[] DEFAULT ARRAY['1', '2', '3', '4', '5', '6']::TEXT[],
    "studentCount" BIGINT NOT NULL,
    "doubtsSolved" BIGINT NOT NULL,
    "averageRating" DOUBLE PRECISION NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modefiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phone" VARCHAR(13) NOT NULL,
    "subjectId" INTEGER,

    CONSTRAINT "mentor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qualifications" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "year" TIMESTAMP(3) NOT NULL,
    "mentorId" INTEGER NOT NULL,

    CONSTRAINT "qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorRatings" (
    "id" SERIAL NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modefiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,

    CONSTRAINT "mentorRatings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" SERIAL NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "Subject" TEXT NOT NULL DEFAULT 'English',
    "searchTags" TEXT[],
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modefiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grade" TEXT NOT NULL DEFAULT '1',
    "mentorId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" INTEGER,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ltCourses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "searchTags" TEXT[],
    "price" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "averageRating" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grade" TEXT NOT NULL DEFAULT '1',
    "mentorId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "subjects" INTEGER[],
    "enrolledStudents" INTEGER NOT NULL DEFAULT 0,
    "thumbnailUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL,
    "prerequisites" TEXT[],
    "updatedOn" TIMESTAMP(3) NOT NULL,
    "syllabus" TEXT[],
    "subjectId" INTEGER NOT NULL,
    "subjectBundleId" INTEGER,

    CONSTRAINT "ltCourses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjectBundle" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "subjectBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courseRatings" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(100) NOT NULL,
    "averageRating" DOUBLE PRECISION NOT NULL,
    "userId" INTEGER,
    "mentorId" INTEGER,
    "coursesId" INTEGER NOT NULL,

    CONSTRAINT "courseRatings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" SERIAL NOT NULL,
    "subject" VARCHAR(128) NOT NULL,
    "name" TEXT NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modefiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadLine" TIMESTAMP(3),
    "mentorId" INTEGER NOT NULL,
    "coursesId" INTEGER NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission" (
    "id" SERIAL NOT NULL,
    "coursesId" INTEGER NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endUsersId" INTEGER NOT NULL,
    "assignmentsId" INTEGER NOT NULL,

    CONSTRAINT "submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubt" (
    "id" SERIAL NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "topic" VARCHAR(255) NOT NULL,
    "status" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "mentorId" INTEGER,

    CONSTRAINT "doubt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubtResponse" (
    "id" SERIAL NOT NULL,
    "response" TEXT NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doubtId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,

    CONSTRAINT "doubtResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log" (
    "id" SERIAL NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "info" VARCHAR(255) NOT NULL,
    "fullTrace" TEXT NOT NULL,
    "initiatorID" INTEGER NOT NULL,

    CONSTRAINT "log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" SERIAL NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resourceURL" TEXT NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playTime" INTEGER NOT NULL,
    "coursesId" INTEGER NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password" VARCHAR(64) NOT NULL,
    "email" VARCHAR(255) NOT NULL,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer" (
    "id" SERIAL NOT NULL,
    "details" TEXT NOT NULL,
    "terms" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offerCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetCourse" INTEGER NOT NULL DEFAULT 0,
    "isPercentage" BOOLEAN NOT NULL DEFAULT false,
    "discountQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxSaving" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banner" (
    "id" SERIAL NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "offerId" INTEGER NOT NULL,

    CONSTRAINT "banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcqTest" (
    "id" SERIAL NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mentorId" INTEGER NOT NULL,
    "coursesId" INTEGER NOT NULL,

    CONSTRAINT "mcqTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcq" (
    "id" SERIAL NOT NULL,
    "option1" TEXT NOT NULL,
    "option2" TEXT NOT NULL,
    "option3" TEXT NOT NULL,
    "option4" TEXT NOT NULL,
    "answer" INTEGER NOT NULL,
    "mcqTestId" INTEGER NOT NULL,

    CONSTRAINT "mcq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcqResponses" (
    "id" SERIAL NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response" INTEGER NOT NULL,
    "mcqId" INTEGER NOT NULL,
    "mcqTestId" INTEGER NOT NULL,
    "endUsersId" INTEGER NOT NULL,

    CONSTRAINT "mcqResponses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "userType" INTEGER NOT NULL,
    "targetId" TEXT NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salesman" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "classes" INTEGER[],
    "passwordHash" TEXT NOT NULL,
    "createOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "salesman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" BIGSERIAL NOT NULL,
    "leadInfo" TEXT NOT NULL,
    "targetPhone" TEXT NOT NULL,
    "coursesId" INTEGER NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "salesmanId" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" BIGSERIAL NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endUsersId" INTEGER NOT NULL,
    "coursesId" INTEGER NOT NULL,
    "orderId" TEXT,
    "status" BOOLEAN,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Messages" (
    "id" BIGSERIAL NOT NULL,
    "to" INTEGER,
    "from" INTEGER,
    "toUUID" TEXT NOT NULL DEFAULT '',
    "fromUUID" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "id" BIGSERIAL NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" BOOLEAN NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "ltCoursesId" INTEGER NOT NULL,
    "endUsersId" INTEGER NOT NULL,
    "serbscriptionBundleId" INTEGER,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationBoard" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EducationBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "educationBoardId" INTEGER NOT NULL,
    "gradeLevel" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subjectBundleId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subjectId" INTEGER NOT NULL,
    "learningObjectives" TEXT[],
    "estimatedDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "chapterId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serbscriptionBundle" (
    "id" SERIAL NOT NULL,

    CONSTRAINT "serbscriptionBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BigCourse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "searchTags" TEXT[],
    "prerequisites" TEXT[],
    "syllabus" TEXT[],
    "category" TEXT,
    "description" TEXT NOT NULL,
    "level" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "isLongTerm" BOOLEAN NOT NULL DEFAULT true,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "averageRating" DOUBLE PRECISION NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "enrolledStudents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grade" TEXT NOT NULL DEFAULT '1',
    "mentorList" INTEGER[],
    "subjectList" INTEGER[],

    CONSTRAINT "BigCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mgSubsciption" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "PurchasePrice" DOUBLE PRECISION NOT NULL,
    "cgst" DOUBLE PRECISION NOT NULL,
    "sgst" DOUBLE PRECISION NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "endUsersId" INTEGER NOT NULL,
    "bigCourseId" INTEGER NOT NULL,
    "OrderId" TEXT,

    CONSTRAINT "mgSubsciption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" SERIAL NOT NULL,
    "detail" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "isGoingOn" BOOLEAN NOT NULL DEFAULT false,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "bigCourseId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "roomId" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PtmSession" (
    "id" SERIAL NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "isGoingOn" BOOLEAN NOT NULL DEFAULT false,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "streamToken" TEXT,
    "roomId" TEXT,
    "bigCourseId" INTEGER NOT NULL,

    CONSTRAINT "PtmSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTest" (
    "id" SERIAL NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,

    CONSTRAINT "SessionTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessionTestQuestion" (
    "id" SERIAL NOT NULL,
    "type" "qtype" NOT NULL DEFAULT 'multipleChoice',
    "question" TEXT NOT NULL DEFAULT 'this is some question',
    "option1" TEXT NOT NULL,
    "option2" TEXT NOT NULL,
    "option3" TEXT,
    "option4" TEXT,
    "correctResponse" INTEGER NOT NULL,
    "sessionTestId" INTEGER NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessionTestQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessionTestSubmission" (
    "id" SERIAL NOT NULL,
    "sessionTestId" INTEGER NOT NULL,
    "endUsersId" INTEGER NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessionTestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessionTestResponse" (
    "id" SERIAL NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response" INTEGER NOT NULL,
    "sessionTestQuestionId" INTEGER NOT NULL,
    "sessionTestId" INTEGER NOT NULL,
    "endUsersId" INTEGER NOT NULL,
    "sessionTestSubmissionId" INTEGER NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessionTestResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bgreview" (
    "id" SERIAL NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bigCourseId" INTEGER NOT NULL,
    "endUsersId" INTEGER NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bgreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendanceRecord" (
    "id" SERIAL NOT NULL,
    "endUsersId" INTEGER NOT NULL,
    "bigCourseId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitTime" TIMESTAMP(3),
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachIntro" (
    "id" SERIAL NOT NULL,
    "comment" TEXT NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "bigCourseId" INTEGER NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachIntro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctest" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "Duration" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "bigCourseId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ctest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctestQuestions" (
    "id" SERIAL NOT NULL,
    "type" "qtype" NOT NULL DEFAULT 'multipleChoice',
    "question" TEXT NOT NULL DEFAULT 'this is some question text',
    "option1" TEXT NOT NULL,
    "option2" TEXT NOT NULL,
    "option3" TEXT,
    "option4" TEXT,
    "correctResponse" INTEGER NOT NULL,
    "ctestId" INTEGER NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ctestQuestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ctestSubmission" (
    "id" SERIAL NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ctestId" INTEGER NOT NULL,
    "endUsersId" INTEGER NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ctestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cTestResponse" (
    "id" SERIAL NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response" INTEGER NOT NULL,
    "endUsersId" INTEGER NOT NULL,
    "ctestQuestionsId" INTEGER NOT NULL,
    "ctestId" INTEGER NOT NULL,
    "ctestSubmissionId" INTEGER NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cTestResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjectRecord" (
    "id" SERIAL NOT NULL,
    "comment" TEXT NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "mentorId" INTEGER,
    "doubtId" INTEGER,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjectRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "minPurchase" DOUBLE PRECISION NOT NULL,
    "maxValue" DOUBLE PRECISION NOT NULL,
    "validity" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "bigCourseId" INTEGER NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessionStreamInfo" (
    "id" SERIAL NOT NULL,
    "roomId" TEXT,
    "hostId" TEXT,
    "Token" TEXT,
    "StreamId" TEXT,
    "sessionId" INTEGER NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessionStreamInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads2" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "misc" TEXT,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bigCourseId" INTEGER NOT NULL,
    "salesmanId" BIGINT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "leads2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacherAttendanceRecord" (
    "id" SERIAL NOT NULL,
    "loginTime" TIMESTAMP(3),
    "logoutTime" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mentorId" INTEGER NOT NULL,

    CONSTRAINT "teacherAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrManager" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" SERIAL NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actor" TEXT,
    "createOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defaultHolidays" (
    "id" SERIAL NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "occasion" TEXT NOT NULL,
    "otherInfor" TEXT,

    CONSTRAINT "defaultHolidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inq" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salesManAttendanceRecord" (
    "id" SERIAL NOT NULL,
    "loginTime" TIMESTAMP(3),
    "logoutTime" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "salesmanId" BIGINT NOT NULL,

    CONSTRAINT "salesManAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Salesleaves" (
    "id" SERIAL NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actor" TEXT,
    "salesmanId" BIGINT NOT NULL,
    "createOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Salesleaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" SERIAL NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "BookValue" DOUBLE PRECISION NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "assetSerial" TEXT NOT NULL,
    "assetStatus" TEXT NOT NULL,
    "createOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assetRecords" (
    "id" SERIAL NOT NULL,
    "transactionType" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "reciever" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "remark" TEXT,
    "assetId" INTEGER NOT NULL,
    "createOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updateOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assetRecords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubtRecord" (
    "id" SERIAL NOT NULL,
    "doubtsAsked" INTEGER NOT NULL DEFAULT 0,
    "doubtsRemaining" INTEGER NOT NULL DEFAULT 5,
    "endUsersId" INTEGER NOT NULL,

    CONSTRAINT "doubtRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubtPackagePurchases" (
    "id" SERIAL NOT NULL,
    "endUsersId" INTEGER,
    "doubtRecordId" INTEGER NOT NULL,
    "orderID" TEXT,
    "DoubtCount" INTEGER NOT NULL,
    "createOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doubtPackagePurchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groupChatInfo" (
    "id" SERIAL NOT NULL,
    "groupName" TEXT,
    "admins" TEXT[],
    "students" TEXT[],
    "createOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "groupChatInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "endUsers_phone_key" ON "endUsers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "submission_assignmentsId_endUsersId_key" ON "submission"("assignmentsId", "endUsersId");

-- CreateIndex
CREATE UNIQUE INDEX "mcqResponses_mcqTestId_mcqId_endUsersId_key" ON "mcqResponses"("mcqTestId", "mcqId", "endUsersId");

-- CreateIndex
CREATE UNIQUE INDEX "salesman_email_key" ON "salesman"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EducationBoard_name_key" ON "EducationBoard"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "mgSubsciption_endUsersId_bigCourseId_key" ON "mgSubsciption"("endUsersId", "bigCourseId");

-- CreateIndex
CREATE UNIQUE INDEX "attendanceRecord_endUsersId_bigCourseId_sessionId_key" ON "attendanceRecord"("endUsersId", "bigCourseId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "parent_phone_key" ON "parent"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "asset_assetSerial_key" ON "asset"("assetSerial");

-- AddForeignKey
ALTER TABLE "endUsers" ADD CONSTRAINT "endUsers_educationBoardId_fkey" FOREIGN KEY ("educationBoardId") REFERENCES "EducationBoard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endUsers" ADD CONSTRAINT "endUsers_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor" ADD CONSTRAINT "mentor_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorRatings" ADD CONSTRAINT "mentorRatings_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorRatings" ADD CONSTRAINT "mentorRatings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "endUsers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ltCourses" ADD CONSTRAINT "ltCourses_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ltCourses" ADD CONSTRAINT "ltCourses_subjectBundleId_fkey" FOREIGN KEY ("subjectBundleId") REFERENCES "subjectBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ltCourses" ADD CONSTRAINT "ltCourses_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ltCourses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ltCourses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courseRatings" ADD CONSTRAINT "courseRatings_coursesId_fkey" FOREIGN KEY ("coursesId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courseRatings" ADD CONSTRAINT "courseRatings_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courseRatings" ADD CONSTRAINT "courseRatings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "endUsers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_coursesId_fkey" FOREIGN KEY ("coursesId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_assignmentsId_fkey" FOREIGN KEY ("assignmentsId") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_coursesId_fkey" FOREIGN KEY ("coursesId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt" ADD CONSTRAINT "doubt_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt" ADD CONSTRAINT "doubt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubtResponse" ADD CONSTRAINT "doubtResponse_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "doubt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubtResponse" ADD CONSTRAINT "doubtResponse_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_coursesId_fkey" FOREIGN KEY ("coursesId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner" ADD CONSTRAINT "banner_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcqTest" ADD CONSTRAINT "mcqTest_coursesId_fkey" FOREIGN KEY ("coursesId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcqTest" ADD CONSTRAINT "mcqTest_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcq" ADD CONSTRAINT "mcq_mcqTestId_fkey" FOREIGN KEY ("mcqTestId") REFERENCES "mcqTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcqResponses" ADD CONSTRAINT "mcqResponses_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcqResponses" ADD CONSTRAINT "mcqResponses_mcqId_fkey" FOREIGN KEY ("mcqId") REFERENCES "mcq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcqResponses" ADD CONSTRAINT "mcqResponses_mcqTestId_fkey" FOREIGN KEY ("mcqTestId") REFERENCES "mcqTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "salesman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_coursesId_fkey" FOREIGN KEY ("coursesId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_coursesId_fkey" FOREIGN KEY ("coursesId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_ltCoursesId_fkey" FOREIGN KEY ("ltCoursesId") REFERENCES "ltCourses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_serbscriptionBundleId_fkey" FOREIGN KEY ("serbscriptionBundleId") REFERENCES "serbscriptionBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_educationBoardId_fkey" FOREIGN KEY ("educationBoardId") REFERENCES "EducationBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_subjectBundleId_fkey" FOREIGN KEY ("subjectBundleId") REFERENCES "subjectBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mgSubsciption" ADD CONSTRAINT "mgSubsciption_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mgSubsciption" ADD CONSTRAINT "mgSubsciption_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PtmSession" ADD CONSTRAINT "PtmSession_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTest" ADD CONSTRAINT "SessionTest_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTest" ADD CONSTRAINT "SessionTest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessionTestQuestion" ADD CONSTRAINT "sessionTestQuestion_sessionTestId_fkey" FOREIGN KEY ("sessionTestId") REFERENCES "SessionTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessionTestSubmission" ADD CONSTRAINT "sessionTestSubmission_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessionTestSubmission" ADD CONSTRAINT "sessionTestSubmission_sessionTestId_fkey" FOREIGN KEY ("sessionTestId") REFERENCES "SessionTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessionTestResponse" ADD CONSTRAINT "sessionTestResponse_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessionTestResponse" ADD CONSTRAINT "sessionTestResponse_sessionTestId_fkey" FOREIGN KEY ("sessionTestId") REFERENCES "SessionTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessionTestResponse" ADD CONSTRAINT "sessionTestResponse_sessionTestQuestionId_fkey" FOREIGN KEY ("sessionTestQuestionId") REFERENCES "sessionTestQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessionTestResponse" ADD CONSTRAINT "sessionTestResponse_sessionTestSubmissionId_fkey" FOREIGN KEY ("sessionTestSubmissionId") REFERENCES "sessionTestSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bgreview" ADD CONSTRAINT "Bgreview_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bgreview" ADD CONSTRAINT "Bgreview_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendanceRecord" ADD CONSTRAINT "attendanceRecord_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendanceRecord" ADD CONSTRAINT "attendanceRecord_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendanceRecord" ADD CONSTRAINT "attendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachIntro" ADD CONSTRAINT "TeachIntro_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachIntro" ADD CONSTRAINT "TeachIntro_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachIntro" ADD CONSTRAINT "TeachIntro_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctest" ADD CONSTRAINT "ctest_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctest" ADD CONSTRAINT "ctest_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctest" ADD CONSTRAINT "ctest_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctestQuestions" ADD CONSTRAINT "ctestQuestions_ctestId_fkey" FOREIGN KEY ("ctestId") REFERENCES "ctest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctestSubmission" ADD CONSTRAINT "ctestSubmission_ctestId_fkey" FOREIGN KEY ("ctestId") REFERENCES "ctest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ctestSubmission" ADD CONSTRAINT "ctestSubmission_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cTestResponse" ADD CONSTRAINT "cTestResponse_ctestId_fkey" FOREIGN KEY ("ctestId") REFERENCES "ctest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cTestResponse" ADD CONSTRAINT "cTestResponse_ctestQuestionsId_fkey" FOREIGN KEY ("ctestQuestionsId") REFERENCES "ctestQuestions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cTestResponse" ADD CONSTRAINT "cTestResponse_ctestSubmissionId_fkey" FOREIGN KEY ("ctestSubmissionId") REFERENCES "ctestSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cTestResponse" ADD CONSTRAINT "cTestResponse_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjectRecord" ADD CONSTRAINT "subjectRecord_doubtId_fkey" FOREIGN KEY ("doubtId") REFERENCES "doubt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjectRecord" ADD CONSTRAINT "subjectRecord_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjectRecord" ADD CONSTRAINT "subjectRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount" ADD CONSTRAINT "discount_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessionStreamInfo" ADD CONSTRAINT "sessionStreamInfo_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads2" ADD CONSTRAINT "leads2_bigCourseId_fkey" FOREIGN KEY ("bigCourseId") REFERENCES "BigCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads2" ADD CONSTRAINT "leads2_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "salesman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacherAttendanceRecord" ADD CONSTRAINT "teacherAttendanceRecord_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salesManAttendanceRecord" ADD CONSTRAINT "salesManAttendanceRecord_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "salesman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salesleaves" ADD CONSTRAINT "Salesleaves_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "salesman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assetRecords" ADD CONSTRAINT "assetRecords_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubtRecord" ADD CONSTRAINT "doubtRecord_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubtPackagePurchases" ADD CONSTRAINT "doubtPackagePurchases_doubtRecordId_fkey" FOREIGN KEY ("doubtRecordId") REFERENCES "doubtRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubtPackagePurchases" ADD CONSTRAINT "doubtPackagePurchases_endUsersId_fkey" FOREIGN KEY ("endUsersId") REFERENCES "endUsers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
