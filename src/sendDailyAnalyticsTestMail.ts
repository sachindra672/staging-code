import nodemailer from "nodemailer";
import { sendAnalyticsMail } from "./utils/mail";

function buildMockAnalyticsHtml() {
    const todayIST = new Date();
    todayIST.setHours(0, 0, 0, 0);

    const courseName = "Physics";
    const teacherName = "Mr. Arun";
    const sessions = [
        {
            name: "Motion in One Dimension",
            grade: "10",
            scheduled: 60,
            actual: 55,
            finishRate: 0.92,
            lateRate: 0.15,
            earlyRate: 0.1,
            students: [
                {
                    name: "John Doe",
                    email: "john@example.com",
                    totalDurationMin: 55,
                    isLateJoin: false,
                    isEarlyLeave: false,
                    intervals: [
                        { join: "9:00 AM", leave: "9:55 AM", duration: 55 },
                    ],
                },
                {
                    name: "Priya Sharma",
                    email: "priya@example.com",
                    totalDurationMin: 46,
                    isLateJoin: true,
                    isEarlyLeave: true,
                    intervals: [
                        { join: "9:10 AM", leave: "9:56 AM", duration: 46 },
                    ],
                },
            ],
        },
    ];

    const rows = sessions.map((a, i) => {
        const studentRows = a.students
            .map(
                (s, idx) => `
                <tr>
                    <td style="padding:6px;">${idx + 1}</td>
                    <td style="padding:6px;">${s.name}</td>
                    <td style="padding:6px;">${s.email}</td>
                    <td style="padding:6px;">${s.totalDurationMin} min</td>
                    <td style="padding:6px;">${s.isLateJoin ? "⏰" : ""}</td>
                    <td style="padding:6px;">${s.isEarlyLeave ? "🚪" : ""}</td>
                </tr>`
            )
            .join("");

        return `
        <tr style="border-bottom:1px solid #ddd;">
            <td style="padding:8px;">${i + 1}</td>
            <td style="padding:8px;">${a.name}</td>
            <td style="padding:8px;">${a.grade}</td>
            <td style="padding:8px;">${teacherName}</td>
            <td style="padding:8px;">${a.scheduled} min</td>
            <td style="padding:8px;">${a.actual} min</td>
            <td style="padding:8px;">${(a.finishRate * 100).toFixed(1)}%</td>
            <td style="padding:8px;">${(a.lateRate * 100).toFixed(1)}%</td>
            <td style="padding:8px;">${(a.earlyRate * 100).toFixed(1)}%</td>
        </tr>
        <tr>
            <td colspan="9" style="padding:10px 20px; background:#f8f9fb;">
                <details>
                    <summary style="cursor:pointer; color:#02bdfe;">👩‍🎓 View Student Details (${a.students.length})</summary>
                    <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:13px;">
                        <thead style="background:#f2f2f2;">
                            <tr>
                                <th>#</th><th>Name</th><th>Email</th><th>Total Duration</th><th>Late</th><th>Early Leave</th>
                            </tr>
                        </thead>
                        <tbody>${studentRows}</tbody>
                    </table>
                </details>
            </td>
        </tr>`;
    }).join("");

    return `
    <div style="font-family:Arial, sans-serif; padding:20px;">
        <h2 style="color:#02bdfe; text-align:center;">📊 Daily Session Analytics Summary</h2>
        <p style="text-align:center;">Report for: <strong>${todayIST.toDateString()}</strong></p>
        <h3 style="margin-top:40px; color:#02bdfe;">📘 Course: ${courseName}</h3>
        <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:30px;">
            <thead style="background:#f0f0f0;">
                <tr>
                    <th>#</th><th>Session</th><th>Class</th><th>Teacher</th><th>Scheduled</th><th>Actual</th><th>Finish%</th><th>Late%</th><th>Early%</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <p style="text-align:center; color:#888; margin-top:30px;">
            This is an automated report from <strong style="color:#02bdfe;">SISYA CLASS</strong>.
        </p>
    </div>`;
}

export const sendDailyAnalyticsTestMail = async () => {
    const html = buildMockAnalyticsHtml();

    await sendAnalyticsMail({
            to: ["ramki@sisyaclass.com","sachindra@sisyaclass.com"],
            subject: `📊 SISYA Daily Session Analytics - test with mock data}`,
            html,
        });

    console.log("✅ Test mail sent:");
};
