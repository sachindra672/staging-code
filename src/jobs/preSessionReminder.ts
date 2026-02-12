import cron from "node-cron";
import { prisma } from "../misc";

cron.schedule("* * * * *", async () => {
    const now = new Date();

    try {
        // Look ahead 11 minutes for upcoming sessions
        const upcomingSessions = await prisma.session.findMany({
            where: {
                isDone: false,
                startTime: {
                    gte: now,
                    lte: new Date(now.getTime() + 11 * 60 * 1000),
                },
            },
            include: {
                course: {
                    include: {
                        mgSubsciption: { include: { user: true } },
                    },
                },
            },
        });

        for (const s of upcomingSessions) {
            const minsUntilStart = Math.floor(
                (s.startTime.getTime() - now.getTime()) / 60000
            );

            // Fire only at exactly 10 or 5 minutes before start
            if (minsUntilStart !== 10 && minsUntilStart !== 5) continue;

            const type = minsUntilStart === 10 ? "10min" : "5min";
            const allStudents = s.course.mgSubsciption.map(sub => sub.user);

            for (const st of allStudents) {
                if (!st.deviceId) continue;

                // Prevent duplicate reminders
                const alreadySent = await prisma.preSessionReminder.findUnique({
                    where: {
                        sessionId_studentId_type: {
                            sessionId: s.id,
                            studentId: st.id,
                            type,
                        },
                    },
                });

                if (alreadySent) continue;

                await sendNotif(
                    st.deviceId,
                    s.detail,
                    s.roomId,
                    `Your session "${s.detail}" will start in ${minsUntilStart} minutes.`
                );

                await prisma.preSessionReminder.create({
                    data: {
                        sessionId: s.id,
                        studentId: st.id,
                        type,
                    },
                });
            }
        }
    } catch (err) {
        console.error("Pre-class reminder job error:", err);
    }
});

async function sendNotif(
    token: string,
    sessionName: string,
    roomId: string | null,
    body: string
) {
    try {
        await fetch("http://127.0.0.1:4004/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tokens: [token],
                data: {
                    title: "Upcoming Class",
                    body,
                    type: "pre_session_reminder",
                    roomId,
                },
            }),
        });
        console.log(`Pre-class notif sent to ${token} for ${sessionName}`);
    } catch (err) {
        console.error("Notif error:", err);
    }
}
