import cron from "node-cron";
import { prisma } from "../misc";

const MAX_ATTEMPTS = 5;

cron.schedule("* * * * *", async () => {
    const now = new Date();

    try {
        const sessions = await prisma.session.findMany({
            where: {
                isDone: false,
                startTime: { lte: now },
            },
            include: {
                course: {
                    include: {
                        mgSubsciption: { include: { user: true } },
                    },
                },
            },
        });

        for (const s of sessions) {
            const graceMs = s.duration * 0.2 * 60 * 1000;
            const checkTime = new Date(s.startTime.getTime() + graceMs);

            if (now < checkTime) continue; // wait until grace period passes

            const attended = await prisma.attendanceRecord.findMany({
                where: { sessionId: s.id },
                select: { endUsersId: true },
            });
            const attendedIds = attended.map(a => a.endUsersId);

            const allStudents = s.course.mgSubsciption.map(sub => sub.user);
            const absentStudents = allStudents.filter(
                u => !attendedIds.includes(u.id)
            );

            for (const st of absentStudents) {
                if (!st.deviceId) continue;

                let reminder = await prisma.sessionReminder.findUnique({
                    where: { sessionId_studentId: { sessionId: s.id, studentId: st.id } },
                });

                if (!reminder) {
                    // First notification after 10 min
                    const firstSendTime = new Date(s.startTime.getTime() + 10 * 60 * 1000);
                    if (now >= firstSendTime) {
                        await sendNotif(st.deviceId, s.detail, s.roomId);
                        await prisma.sessionReminder.create({
                            data: {
                                sessionId: s.id,
                                studentId: st.id,
                                lastSentAt: now,
                                attempt: 1,
                            },
                        });
                    }
                    continue;
                }

                // Stop if max attempts reached
                if (reminder.attempt >= MAX_ATTEMPTS) continue;

                // Calculate exponential backoff: 2, 4, 8, 16...
                const delayMinutes = Math.pow(2, reminder.attempt);
                const nextSendTime = new Date(
                    reminder.lastSentAt.getTime() + delayMinutes * 60 * 1000
                );

                if (now >= nextSendTime) {
                    await sendNotif(st.deviceId, s.detail, s.roomId);
                    await prisma.sessionReminder.update({
                        where: { sessionId_studentId: { sessionId: s.id, studentId: st.id } },
                        data: {
                            lastSentAt: now,
                            attempt: { increment: 1 },
                        },
                    });
                }
            }
        }
    } catch (err) {
        console.error("Cron job error:", err);
    }
});

async function sendNotif(token: string, sessionName: string, roomId: string | null) {
    try {
        await fetch("http://127.0.0.1:4004/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tokens: [token],
                data: {
                    title: "Join your class",
                    body: `Your session "${sessionName}" is live. Please join.`,
                    type: "session_reminder",
                    roomId,
                },
            }),
        });
        console.log(`Sent notif to ${token} for ${sessionName}`);
    } catch (err) {
        console.error("Notif error:", err);
    }
}
