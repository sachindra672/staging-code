import cron from "node-cron"
import { prisma } from "../misc"


cron.schedule(
    "0 0 * * *", // every minute
    async () => {
        console.log("Running course rating update...");

        try {
            await prisma.$executeRawUnsafe(`
  UPDATE "BigCourse" bc
  SET "averageRating" = COALESCE(sub.avg_rating, 4.6)
  FROM (
    SELECT s."bigCourseId" AS course_id, AVG(f.rating) AS avg_rating
    FROM "session" s
    LEFT JOIN "SessionFeedback" f ON f."sessionId" = s.id
    GROUP BY s."bigCourseId"
  ) sub
  WHERE bc.id = sub.course_id;
`);

            console.log("All course ratings updated");
        } catch (err) {
            console.error("Error updating course ratings:", err);
        } finally {
            console.log("Course rating update finished.");
        }
    },
    {
        timezone: "Asia/Kolkata",
    }
);
