import { Request, Response } from "express";
import { prisma } from './misc';
import { sendAnalyticsMail } from "./utils/mail";
import * as XLSX from "xlsx";
import { grantTaskReward } from './sisyacoin/taskRewardController'
import { getSystemWallet } from './config/sisyacoinHelperFunctions'
import { Decimal } from "@prisma/client/runtime/library";
// import path from "path";
// import ejs from "ejs";

const msToDate = (ms: number): Date => new Date(ms);

const FINISH_THRESHOLD = 0.9;
const LATE_JOIN_THRESHOLD_RATIO = 0.1;

interface StudentSessionInterval {
    joinTime: number;
    leaveTime: number;
}

interface StudentAnalyticsInput {
    userID: string;
    userName: string;
    sessions: StudentSessionInterval[];
}

interface TeacherAnalyticsInput {
    teacherId: number;
    startTime: number;
    endTime: number;
}

interface AnalyticsCreateRequestBody {
    sessionId: number;
    scheduledDuration: number;
    classStartTime: number;
    classEndTime: number;
    students: StudentAnalyticsInput[];
    teacherAnalytics: TeacherAnalyticsInput;
}

// export async function addSessionAnalytics(
//     req: Request<{}, {}, AnalyticsCreateRequestBody>,
//     res: Response
// ) {
//     try {
//         const {
//             sessionId,
//             scheduledDuration,
//             classStartTime,
//             classEndTime,
//             students,
//             teacherAnalytics,
//         } = req.body;

//         // 1. Basic validation
//         if (
//             !sessionId ||
//             !scheduledDuration ||
//             !classStartTime ||
//             !classEndTime ||
//             !students?.length ||
//             !teacherAnalytics
//         ) {
//             return res.status(400).json({ error: "Missing required fields" });
//         }

//         // 2. Fetch session info
//         const session = await prisma.session.findUnique({
//             where: { id: sessionId },
//             select: {
//                 startTime: true,
//                 endTime: true,
//                 detail: true,
//                 SessionTest: { select: { id: true } },
//                 mentor: { select: { name: true, email: true } },
//                 course: { select: { name: true } },
//             },
//         });

//         if (!session) {
//             return res.status(404).json({ success: false, error: "Session not found" });
//         }

//         // 3. Batch fetch student IDs from UUIDs
//         const studentUuids = students.map((s) => s.userID);
//         const userRecords = await prisma.endUsers.findMany({
//             where: { uuid: { in: studentUuids } },
//             select: { id: true, uuid: true },
//         });
//         const uuidToIdMap = new Map(userRecords.map((u) => [u.uuid, u.id]));

//         // 4. Time calculations
//         const scheduledStartMs = session.startTime.getTime();
//         const scheduledEndMs = session.endTime.getTime();
//         const totalDurationMs = scheduledEndMs - scheduledStartMs;
//         const lateJoinThresholdMs = scheduledStartMs + totalDurationMs * LATE_JOIN_THRESHOLD_RATIO;

//         const classStart = msToDate(classStartTime);
//         const classEnd = msToDate(classEndTime);
//         const actualDuration = Math.round((classEndTime - classStartTime) / 60000);

//         let finishCount = 0;
//         let earlyLeaveCount = 0;
//         let lateJoinCount = 0;
//         const totalStudents = students.length;

//         // 5. Build student interval records using ID from uuidToIdMap
//         const studentIntervalRecords = students.flatMap((student) => {
//             const studentId = uuidToIdMap.get(student.userID);
//             if (!studentId) {
//                 console.warn(`⚠️ Student not found for UUID: ${student.userID}`);
//                 return [];
//             }

//             const intervals = student.sessions.map((interval) => {
//                 const join = interval.joinTime;
//                 const leave = interval.leaveTime ?? classEndTime;
//                 const duration = leave - join;

//                 return { joinTime: join, leaveTime: leave, duration };
//             });

//             const validDurations = student.sessions.map((interval) => {
//                 const join = interval.joinTime;
//                 const leave = interval.leaveTime ?? classEndTime;

//                 if (leave <= scheduledStartMs || join >= scheduledEndMs) {
//                     return 0;
//                 }

//                 const effectiveJoin = Math.max(join, scheduledStartMs);
//                 const effectiveLeave = Math.min(leave, scheduledEndMs);
//                 return Math.max(effectiveLeave - effectiveJoin, 0);
//             });

//             const totalAttendanceMs = validDurations.reduce((sum, ms) => sum + ms, 0);
//             const earliestJoin = Math.min(...intervals.map((i) => i.joinTime));
//             const latestLeave = Math.max(...intervals.map((i) => i.leaveTime));

//             if (earliestJoin > lateJoinThresholdMs) lateJoinCount++;
//             if (latestLeave < scheduledEndMs) earlyLeaveCount++;

//             const attendedRatio = totalAttendanceMs / totalDurationMs;
//             if (attendedRatio >= FINISH_THRESHOLD) finishCount++;

//             return intervals.map((interval) => ({
//                 student: { connect: { id: studentId } },
//                 joinTime: msToDate(interval.joinTime),
//                 leaveTime: msToDate(interval.leaveTime),
//                 duration: Math.round(interval.duration / 1000),
//                 isLateJoin: interval.joinTime > lateJoinThresholdMs,
//                 isEarlyLeave: interval.leaveTime < scheduledEndMs,
//             }));
//         });

//         // 6. Compute rates
//         const finishRate = parseFloat((finishCount / totalStudents).toFixed(3));
//         const earlyLeaveRate = parseFloat((earlyLeaveCount / totalStudents).toFixed(3));
//         const lateJoinRate = parseFloat((lateJoinCount / totalStudents).toFixed(3));

//         // 7. Save analytics with intervals + teacher attendance
//         const analytics = await prisma.sessionAnalytics.create({
//             data: {
//                 session: { connect: { id: sessionId } },
//                 classStartTime: classStart,
//                 classEndTime: classEnd,
//                 actualDuration,
//                 scheduledDuration: totalDurationMs / 60000,
//                 finishRate,
//                 earlyLeaveRate,
//                 lateJoinRate,
//                 studentIntervals: {
//                     create: studentIntervalRecords,
//                 },
//                 teacherAttendance: {
//                     create: {
//                         teacher: { connect: { id: +teacherAnalytics.teacherId } },
//                         startTime: msToDate(teacherAnalytics.startTime),
//                         endTime: msToDate(teacherAnalytics.endTime),
//                         totalDuration: Math.round(
//                             (teacherAnalytics.endTime - teacherAnalytics.startTime) / 1000
//                         ),
//                     },
//                 },
//             },
//         });

//         // 8. Homework & Email HTML generation
//         const homeworkStatus =
//             session.SessionTest.length > 0 ? "Uploaded" : "Not Uploaded";

//         const emailHtml = `
//             <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background-color: #f9f9f9;">
//               <div style="text-align: center; margin-bottom: 20px;">
//                 <img src="https://sisyabackend.in/student/mg_mat/49/logo.png" alt="Company Logo" style="max-width: 150px; height: auto;" />
//               </div>

//               <h2 style="color: #02bdfe; text-align: center;">📊 Session Analytics Report</h2>

//               <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
//                 <tr><td style="padding: 8px;"><strong>Session ID:</strong></td><td style="padding: 8px;">${sessionId}</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Session Name:</strong></td><td style="padding: 8px;">${session.detail}</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Course Name:</strong></td><td style="padding: 8px;">${session.course.name}</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Class Time (IST):</strong></td><td style="padding: 8px;">${session.startTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} - ${session.endTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Scheduled Duration:</strong></td><td style="padding: 8px;">${totalDurationMs / 60000} mins</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Actual Duration:</strong></td><td style="padding: 8px;">${actualDuration} mins</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Total Students:</strong></td><td style="padding: 8px;">${totalStudents}</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Finish Rate:</strong></td><td style="padding: 8px;">${(finishRate * 100).toFixed(2)}%</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Late Join Rate:</strong></td><td style="padding: 8px;">${(lateJoinRate * 100).toFixed(2)}%</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Early Leave Rate:</strong></td><td style="padding: 8px;">${(earlyLeaveRate * 100).toFixed(2)}%</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Homework Upload Status:</strong></td><td style="padding: 8px;">${homeworkStatus}</td></tr>
//               </table>

//               <hr style="margin: 30px 0; border: none; border-top: 1px solid #ccc;" />

//               <h3 style="color: #333;">👨‍🏫 Teacher Details</h3>
//               <table style="width: 100%; border-collapse: collapse;">
//                 <tr><td style="padding: 8px;"><strong>Teacher ID:</strong></td><td style="padding: 8px;">${teacherAnalytics.teacherId}</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Teacher Name:</strong></td><td style="padding: 8px;">${session.mentor.name}</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Teacher Email:</strong></td><td style="padding: 8px;">${session.mentor.email}</td></tr>
//                 <tr><td style="padding: 8px;"><strong>Start Time (IST):</strong></td><td style="padding: 8px;">${msToDate(teacherAnalytics.startTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td></tr>
//                 <tr><td style="padding: 8px;"><strong>End Time (IST):</strong></td><td style="padding: 8px;">${msToDate(teacherAnalytics.endTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td></tr>
//               </table>

//               <p style="text-align: center; color: #888; margin-top: 30px;">This is an automated email from the <span style="color: #02bdfe;">SISYA CLASS</span></p>
//             </div>
//         `;

//         // Optional: Send email if required
//         // await sendAnalyticsMail({ to: ["sachindra@sisyaclass.com"], subject: `Session Analytics Report - Session ID ${sessionId}`, html: emailHtml });

//         return res.status(201).json({ success: true, analytics });
//     } catch (error: any) {
//         console.error("Error creating analytics:", error);
//         return res.status(500).json({
//             success: false,
//             error: "Internal server error",
//             message: error.message,
//         });
//     }
// }

export async function addSessionAnalytics(
    req: Request<{}, {}, AnalyticsCreateRequestBody>,
    res: Response
) {
    try {
        const {
            sessionId,
            scheduledDuration,
            classStartTime,
            classEndTime,
            students,
            teacherAnalytics,
        } = req.body;

        // 1. Basic validation
        if (
            !sessionId ||
            !scheduledDuration ||
            !classStartTime ||
            !classEndTime ||
            !teacherAnalytics
        ) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // 2. Fetch session info
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: {
                startTime: true,
                endTime: true,
                detail: true,
                SessionTest: { select: { id: true } },
                mentor: { select: { name: true, email: true } },
                course: { select: { name: true } },
            },
        });

        if (!session) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }

        // Convert class start/end
        const classStart = msToDate(classStartTime);
        const classEnd = msToDate(classEndTime);
        const actualDuration = Math.round((classEndTime - classStartTime) / 60000);

        // SPECIAL CASE HANDLING → No students joined at all
        if (!students || students.length === 0) {
            const analytics = await prisma.sessionAnalytics.create({
                data: {
                    session: { connect: { id: sessionId } },
                    classStartTime: classStart,
                    classEndTime: classEnd,
                    actualDuration,
                    scheduledDuration,
                    finishRate: 0,
                    earlyLeaveRate: 0,
                    lateJoinRate: 0,
                    studentIntervals: { create: [] }, // no intervals
                    teacherAttendance: {
                        create: {
                            teacher: { connect: { id: +teacherAnalytics.teacherId } },
                            startTime: msToDate(teacherAnalytics.startTime),
                            endTime: msToDate(teacherAnalytics.endTime),
                            totalDuration: Math.round(
                                (teacherAnalytics.endTime - teacherAnalytics.startTime) / 1000
                            ),
                        },
                    },
                },
            });

            return res.status(201).json({
                success: true,
                message: "Analytics saved successfully (no students joined)",
                analytics,
            });
        }

        // ---- REMAINING LOGIC FOR WHEN STUDENTS JOINED ---- //

        // 3. Batch fetch student IDs from UUIDs
        const studentUuids = students.map((s) => s.userID);
        const userRecords = await prisma.endUsers.findMany({
            where: { uuid: { in: studentUuids } },
            select: { id: true, uuid: true },
        });
        const uuidToIdMap = new Map(userRecords.map((u) => [u.uuid, u.id]));

        // 4. Time calculations
        const scheduledStartMs = session.startTime.getTime();
        const scheduledEndMs = session.endTime.getTime();
        const totalDurationMs = scheduledEndMs - scheduledStartMs;
        const lateJoinThresholdMs =
            scheduledStartMs + totalDurationMs * LATE_JOIN_THRESHOLD_RATIO;

        let finishCount = 0;
        let earlyLeaveCount = 0;
        let lateJoinCount = 0;
        const totalStudents = students.length;

        // 5. Build student interval records
        const studentIntervalRecords = students.flatMap((student) => {
            const studentId = uuidToIdMap.get(student.userID);
            if (!studentId) {
                console.warn(`⚠️ Student not found for UUID: ${student.userID}`);
                return [];
            }

            const intervals = student.sessions.map((interval) => {
                const join = interval.joinTime;
                const leave = interval.leaveTime ?? classEndTime;
                const duration = leave - join;
                return { joinTime: join, leaveTime: leave, duration };
            });

            const validDurations = student.sessions.map((interval) => {
                const join = interval.joinTime;
                const leave = interval.leaveTime ?? classEndTime;

                if (leave <= scheduledStartMs || join >= scheduledEndMs) {
                    return 0;
                }

                const effectiveJoin = Math.max(join, scheduledStartMs);
                const effectiveLeave = Math.min(leave, scheduledEndMs);
                return Math.max(effectiveLeave - effectiveJoin, 0);
            });

            const totalAttendanceMs = validDurations.reduce((s, ms) => s + ms, 0);
            const earliestJoin = Math.min(...intervals.map((i) => i.joinTime));
            const latestLeave = Math.max(...intervals.map((i) => i.leaveTime));

            if (earliestJoin > lateJoinThresholdMs) lateJoinCount++;
            if (latestLeave < scheduledEndMs) earlyLeaveCount++;

            const attendedRatio = totalAttendanceMs / totalDurationMs;
            if (attendedRatio >= FINISH_THRESHOLD) finishCount++;

            return intervals.map((interval) => ({
                student: { connect: { id: studentId } },
                joinTime: msToDate(interval.joinTime),
                leaveTime: msToDate(interval.leaveTime),
                duration: Math.round(interval.duration / 1000),
                isLateJoin: interval.joinTime > lateJoinThresholdMs,
                isEarlyLeave: interval.leaveTime < scheduledEndMs,
            }));
        });

        // 6. Compute rates
        const finishRate = parseFloat((finishCount / totalStudents).toFixed(3));
        const earlyLeaveRate = parseFloat((earlyLeaveCount / totalStudents).toFixed(3));
        const lateJoinRate = parseFloat((lateJoinCount / totalStudents).toFixed(3));

        // 7. Save analytics with intervals + teacher attendance
        const analytics = await prisma.sessionAnalytics.create({
            data: {
                session: { connect: { id: sessionId } },
                classStartTime: classStart,
                classEndTime: classEnd,
                actualDuration,
                scheduledDuration: totalDurationMs / 60000,
                finishRate,
                earlyLeaveRate,
                lateJoinRate,
                studentIntervals: {
                    create: studentIntervalRecords,
                },
                teacherAttendance: {
                    create: {
                        teacher: { connect: { id: +teacherAnalytics.teacherId } },
                        startTime: msToDate(teacherAnalytics.startTime),
                        endTime: msToDate(teacherAnalytics.endTime),
                        totalDuration: Math.round(
                            (teacherAnalytics.endTime - teacherAnalytics.startTime) / 1000
                        ),
                    },
                },
            },
        });

        return res.status(201).json({ success: true, analytics });

    } catch (error: any) {
        console.error("Error creating analytics:", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
            message: error.message,
        });
    }
}

export async function addSessionAnalytics2(
    req: Request<{}, {}, AnalyticsCreateRequestBody>,
    res: Response
) {
    try {
        const {
            sessionId,
            scheduledDuration,
            classStartTime,
            classEndTime,
            students,
            teacherAnalytics,
        } = req.body;

        // 1. Basic validation
        if (
            !sessionId ||
            !scheduledDuration ||
            !classStartTime ||
            !classEndTime ||
            !teacherAnalytics
        ) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // 2. Fetch session info
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: {
                startTime: true,
                endTime: true,
                detail: true,
                SessionTest: { select: { id: true } },
                mentor: { select: { name: true, email: true } },
                course: { select: { name: true } },
            },
        });

        if (!session) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }

        // Convert class start/end
        const classStart = msToDate(classStartTime);
        const classEnd = msToDate(classEndTime);
        const actualDuration = Math.round((classEndTime - classStartTime) / 60000);

        // SPECIAL CASE HANDLING → No students joined at all
        if (!students || students.length === 0) {
            const analytics = await prisma.sessionAnalytics.create({
                data: {
                    session: { connect: { id: sessionId } },
                    classStartTime: classStart,
                    classEndTime: classEnd,
                    actualDuration,
                    scheduledDuration,
                    finishRate: 0,
                    earlyLeaveRate: 0,
                    lateJoinRate: 0,
                    studentIntervals: { create: [] }, // no intervals
                    teacherAttendance: {
                        create: {
                            teacher: { connect: { id: +teacherAnalytics.teacherId } },
                            startTime: msToDate(teacherAnalytics.startTime),
                            endTime: msToDate(teacherAnalytics.endTime),
                            totalDuration: Math.round(
                                (teacherAnalytics.endTime - teacherAnalytics.startTime) / 1000
                            ),
                        },
                    },
                },
            });

            return res.status(201).json({
                success: true,
                message: "Analytics saved successfully (no students joined)",
                analytics,
                rewards: {
                    totalParticipants: 0,
                    totalCoinsDistributed: 0,
                    results: [],
                },
            });
        }

        // ---- REMAINING LOGIC FOR WHEN STUDENTS JOINED ---- //

        // 3. Batch fetch student IDs from UUIDs
        const studentUuids = students.map((s) => s.userID);
        const userRecords = await prisma.endUsers.findMany({
            where: { uuid: { in: studentUuids } },
            select: { id: true, uuid: true, name: true },
        });
        const uuidToIdMap = new Map(userRecords.map((u) => [u.uuid, u.id]));
        const uuidToNameMap = new Map(userRecords.map((u) => [u.uuid, u.name]));

        // 4. Time calculations
        const scheduledStartMs = session.startTime.getTime();
        const scheduledEndMs = session.endTime.getTime();
        const totalDurationMs = scheduledEndMs - scheduledStartMs;
        const lateJoinThresholdMs =
            scheduledStartMs + totalDurationMs * LATE_JOIN_THRESHOLD_RATIO;

        let finishCount = 0;
        let earlyLeaveCount = 0;
        let lateJoinCount = 0;
        const totalStudents = students.length;

        // Store student reward data
        interface StudentRewardData {
            studentId: number;
            userName: string;
            attendedRatio: number;
            isLateJoin: boolean;
            isEarlyLeave: boolean;
        }
        const studentRewardData: StudentRewardData[] = [];

        // 5. Build student interval records
        const studentIntervalRecords = students.flatMap((student) => {
            const studentId = uuidToIdMap.get(student.userID);
            const userName = uuidToNameMap.get(student.userID) || student.userName || "Unknown";
            if (!studentId) {
                console.warn(`⚠️ Student not found for UUID: ${student.userID}`);
                return [];
            }

            const intervals = student.sessions.map((interval) => {
                const join = interval.joinTime;
                const leave = interval.leaveTime ?? classEndTime;
                const duration = leave - join;
                return { joinTime: join, leaveTime: leave, duration };
            });

            const validDurations = student.sessions.map((interval) => {
                const join = interval.joinTime;
                const leave = interval.leaveTime ?? classEndTime;

                if (leave <= scheduledStartMs || join >= scheduledEndMs) {
                    return 0;
                }

                const effectiveJoin = Math.max(join, scheduledStartMs);
                const effectiveLeave = Math.min(leave, scheduledEndMs);
                return Math.max(effectiveLeave - effectiveJoin, 0);
            });

            const totalAttendanceMs = validDurations.reduce((s, ms) => s + ms, 0);
            const earliestJoin = Math.min(...intervals.map((i) => i.joinTime));
            const latestLeave = Math.max(...intervals.map((i) => i.leaveTime));

            const isLateJoin = earliestJoin > lateJoinThresholdMs;
            const isEarlyLeave = latestLeave < scheduledEndMs;

            if (isLateJoin) lateJoinCount++;
            if (isEarlyLeave) earlyLeaveCount++;

            const attendedRatio = totalAttendanceMs / totalDurationMs;
            const attendedPercentage = attendedRatio * 100;
            if (attendedRatio >= FINISH_THRESHOLD) finishCount++;

            // Store reward data
            studentRewardData.push({
                studentId,
                userName,
                attendedRatio: attendedPercentage,
                isLateJoin,
                isEarlyLeave,
            });

            return intervals.map((interval) => ({
                student: { connect: { id: studentId } },
                joinTime: msToDate(interval.joinTime),
                leaveTime: msToDate(interval.leaveTime),
                duration: Math.round(interval.duration / 1000),
                isLateJoin: interval.joinTime > lateJoinThresholdMs,
                isEarlyLeave: interval.leaveTime < scheduledEndMs,
            }));
        });

        // 6. Compute rates
        const finishRate = parseFloat((finishCount / totalStudents).toFixed(3));
        const earlyLeaveRate = parseFloat((earlyLeaveCount / totalStudents).toFixed(3));
        const lateJoinRate = parseFloat((lateJoinCount / totalStudents).toFixed(3));

        // 7. Save analytics with intervals + teacher attendance
        const analytics = await prisma.sessionAnalytics.create({
            data: {
                session: { connect: { id: sessionId } },
                classStartTime: classStart,
                classEndTime: classEnd,
                actualDuration,
                scheduledDuration: totalDurationMs / 60000,
                finishRate,
                earlyLeaveRate,
                lateJoinRate,
                studentIntervals: {
                    create: studentIntervalRecords,
                },
                teacherAttendance: {
                    create: {
                        teacher: { connect: { id: +teacherAnalytics.teacherId } },
                        startTime: msToDate(teacherAnalytics.startTime),
                        endTime: msToDate(teacherAnalytics.endTime),
                        totalDuration: Math.round(
                            (teacherAnalytics.endTime - teacherAnalytics.startTime) / 1000
                        ),
                    },
                },
            },
        });

        // 8. Grant rewards to students based on attendance
        const rewardResults: any[] = [];
        const baseReward = 10;

        const systemWallet = await getSystemWallet();
        const totalParticipants = studentRewardData.length;

        // Calculate total coins needed (estimate: assume all get at least base + bronze)
        const estimatedCoinsNeeded = baseReward * totalParticipants + (5 * totalParticipants);
        const estimatedCoinsNeededDecimal = new Decimal(estimatedCoinsNeeded);

        if (systemWallet.spendableBalance.lt(estimatedCoinsNeededDecimal)) {
            console.warn(
                `System wallet may have insufficient balance for session rewards. Available: ${systemWallet.spendableBalance}, Estimated: ${estimatedCoinsNeeded}`
            );
        }

        // Grant rewards to each student
        for (const studentData of studentRewardData) {
            const { studentId, userName, attendedRatio, isLateJoin, isEarlyLeave } = studentData;

            let coinsAmount = baseReward;
            let reasonParts = [`Base attendance reward: ${baseReward} coins`];
            let tier = "Base";

            // Calculate tier bonus
            if (attendedRatio >= 50 && attendedRatio < 75) {
                coinsAmount += 5;
                reasonParts.push(`Bronze tier (${attendedRatio.toFixed(1)}% attendance): +5 coins`);
                tier = "Bronze";
            } else if (attendedRatio >= 75 && attendedRatio < 90) {
                coinsAmount += 10;
                reasonParts.push(`Silver tier (${attendedRatio.toFixed(1)}% attendance): +10 coins`);
                tier = "Silver";
            } else if (attendedRatio >= 90 && attendedRatio < 100) {
                coinsAmount += 15;
                reasonParts.push(`Gold tier (${attendedRatio.toFixed(1)}% attendance): +15 coins`);
                tier = "Gold";
            } else if (attendedRatio >= 100 && !isLateJoin && !isEarlyLeave) {
                // Perfect: 100% attendance, on-time, no early leave
                coinsAmount += 10;
                reasonParts.push(`Perfect attendance (100%, on-time, stayed until end): +10 coins`);
                tier = "Perfect";
            } else if (attendedRatio >= 100) {
                // 100% attendance but not perfect (late join or early leave)
                coinsAmount += 15;
                reasonParts.push(`Gold tier (100% attendance): +15 coins`);
                tier = "Gold";
            }

            const taskCode = `SESSION_ATTENDANCE_${sessionId}_${studentId}`;
            const amountDecimal = new Decimal(coinsAmount);
            const reason = `Session attendance - ${reasonParts.join(", ")}`;

            try {
                if (systemWallet.spendableBalance.lt(amountDecimal)) {
                    rewardResults.push({
                        userId: studentId,
                        userName: userName,
                        success: false,
                        message: "Insufficient system wallet balance",
                        coinsEarned: 0,
                    });
                    continue;
                }

                const rewardReq = {
                    body: {
                        userId: studentId,
                        taskCode: taskCode,
                        coinsAmount: coinsAmount,
                        reason: reason,
                        metadata: {
                            sessionId: sessionId,
                            sessionDetail: session.detail,
                            attendedRatio: attendedRatio,
                            isLateJoin: isLateJoin,
                            isEarlyLeave: isEarlyLeave,
                            tier: tier,
                        },
                    },
                } as Request;

                let rewardResponseData: any = null;
                const rewardRes = {
                    json: (data: any) => {
                        rewardResponseData = data;
                    },
                    status: (_code: number) => ({
                        json: (data: any) => {
                            rewardResponseData = data;
                        },
                    }),
                } as unknown as Response;

                await grantTaskReward(rewardReq, rewardRes);

                if (rewardResponseData?.success) {
                    rewardResults.push({
                        userId: studentId,
                        userName: userName,
                        success: true,
                        coinsEarned: coinsAmount,
                        message: reasonParts.join(", "),
                        tier: tier,
                        attendedRatio: attendedRatio.toFixed(1),
                        userWallet: rewardResponseData.data?.userWallet || null,
                    });
                } else {
                    rewardResults.push({
                        userId: studentId,
                        userName: userName,
                        success: false,
                        message: rewardResponseData?.message || "Reward grant failed",
                        coinsEarned: 0,
                    });
                }
            } catch (err) {
                console.error(`Error granting reward to user ${studentId}:`, err);
                rewardResults.push({
                    userId: studentId,
                    userName: userName,
                    success: false,
                    message: "Error processing reward",
                    coinsEarned: 0,
                });
            }
        }

        return res.status(201).json({
            success: true,
            analytics,
            rewards: {
                totalParticipants: totalParticipants,
                totalCoinsDistributed: rewardResults
                    .filter((r) => r.success)
                    .reduce((sum, r) => sum + (r.coinsEarned || 0), 0),
                results: rewardResults,
            },
        });

    } catch (error: any) {
        console.error("Error creating analytics:", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error",
            message: error.message,
        });
    }
}

export const submitFeedback = async (req: Request, res: Response) => {
    try {
        const { sessionId, studentId, rating, techIssue, sessionIssue, general } = req.body;

        if (!sessionId || !studentId || typeof rating !== 'number') {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const feedback = await prisma.sessionFeedback.create({
            data: {
                sessionId,
                studentId,
                rating,
                techIssue,
                sessionIssue,
                general
            },
        });

        return res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully',
            feedback
        });
    } catch (err: any) {
        if (err.code === 'P2002') {
            return res.status(409).json({ success: false, error: 'Feedback already submitted' });
        }

        console.error('Submit Feedback Error:', err);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

export const getCourseFeedback = async (req: Request, res: Response) => {
    try {
        const { courseId, page = 1, limit = 10, filter } = req.body;

        if (!courseId) {
            return res.status(400).json({ success: false, message: "courseId is required" });
        }

        const where: any = {
            session: { bigCourseId: courseId }
        };

        if (filter) {
            switch (filter) {
                case "poor":
                    where.rating = { lte: 2 };
                    break;
                case "avg":
                    where.rating = { equals: 3 };
                    break;
                case "good":
                    where.rating = { equals: 4 };
                    break;
                case "excellent":
                    where.rating = { gte: 5 };
                    break;
                case "recent":
                    // no rating filter, just order by createdAt
                    break;
            }
        }

        const reviews = await prisma.sessionFeedback.findMany({
            where,
            include: {
                student: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        });

        const total = await prisma.sessionFeedback.count({ where });

        res.json({
            success: true,
            data: {
                reviews,
                pagination: { page, limit, total }
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

export const getFeedbackStatus = async (req: Request, res: Response) => {
    try {
        const { sessionId, studentId } = req.body;

        if (!sessionId || !studentId) {
            return res.status(400).json({ success: false, error: 'sessionId and studentId are required' });
        }

        const [feedback, attendance] = await Promise.all([
            prisma.sessionFeedback.findUnique({
                where: {
                    sessionId_studentId: {
                        sessionId,
                        studentId,
                    },
                },
            }),
            prisma.attendanceRecord.findFirst({
                where: {
                    sessionId,
                    endUsersId: studentId,
                },
                select: {
                    createdOn: true,
                    exitTime: true
                }
            })
        ]);

        return res.status(200).json({
            success: true,
            isAlreadyFilled: !!feedback,
            feedback,
            isAttendedClass: !!attendance,
        });
    } catch (err) {
        console.error('Get Feedback Status Error:', err);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const groupBy = <T, K extends keyof any>(list: T[], getKey: (item: T) => K): Record<K, T[]> => {
    return list.reduce((acc, item) => {
        const key = getKey(item);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {} as Record<K, T[]>);
};

export const sendDailyAnalyticsEmail = async () => {
    const nowIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const todayIST = new Date(nowIST);
    todayIST.setHours(0, 0, 0, 0);

    const tomorrowIST = new Date(todayIST);
    tomorrowIST.setDate(tomorrowIST.getDate() + 1);

    const todayUTC = new Date(todayIST.toUTCString());
    const tomorrowUTC = new Date(tomorrowIST.toUTCString());

    const sessions = await prisma.sessionAnalytics.findMany({
        where: {
            classStartTime: {
                gte: todayUTC,
                lt: tomorrowUTC,
            },
        },
        include: {
            session: {
                select: {
                    id: true,
                    detail: true,
                    course: { select: { name: true, grade: true } },
                    SessionTest: { select: { id: true } },
                    hostRecordingUrl: true,
                    screenRecordingUrl: true,
                },
            },
            teacherAttendance: {
                select: {
                    teacherId: true,
                    startTime: true,
                    endTime: true,
                    teacher: { select: { name: true, email: true } },
                },
            },
        },
        orderBy: {
            classStartTime: 'asc',
        },
    });

    if (!sessions.length) {
        console.log("📭 No session analytics found for today.");
        return;
    }

    const groupedByCourse = groupBy(
        sessions.filter((s) => s.session),
        (s) => s.session!.course?.name ?? "Uncategorized"
    );

    // const studentCounts = await prisma.studentAttendanceInterval.groupBy({
    //     by: ['analyticsId'],
    //     _count: {
    //         studentId: true,
    //     },
    // });

    const records = await prisma.studentAttendanceInterval.findMany({
        select: {
            analyticsId: true,
            studentId: true,
        },
    });

    const grouped = new Map<string, Set<string>>();

    for (const { analyticsId, studentId } of records) {
        if (!grouped.has(`${analyticsId}`)) {
            grouped.set(`${analyticsId}`, new Set());
        }
        grouped.get(`${analyticsId}`)!.add(String(studentId));
    }

    const uniqueCounts = Array.from(grouped.entries()).map(([analyticsId, studentSet]) => ({
        analyticsId,
        uniqueStudentCount: studentSet.size,
    }));

    const analyticsIdToStudentCount: Record<string, number> = {};
    uniqueCounts.forEach((item) => {
        analyticsIdToStudentCount[item.analyticsId] = item.uniqueStudentCount;
    });

    const courseSections = Object.entries(groupedByCourse).map(([courseName, courseSessions]) => {
        const rows = courseSessions.map((a, i) => {
            const teacherStartTime = a.teacherAttendance?.startTime
                ? new Date(a.teacherAttendance.startTime).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                })
                : "-";

            const teacherEndTime = a.teacherAttendance?.endTime
                ? new Date(a.teacherAttendance.endTime).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                })
                : "-";

            const testStatus = a.session?.SessionTest?.length ? "Uploaded" : "Not Uploaded";

            return `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px; text-align: center;">${i + 1}</td>
         <td style="padding: 8px;">${a.session?.detail ?? '-'}</td>
         <td style="padding: 8px;">${a.session?.course?.grade ?? '-'}</td>
          <td style="padding: 8px;">${teacherStartTime}</td>
          <td style="padding: 8px;">${teacherEndTime}</td>
          <td style="padding: 8px;">${a.scheduledDuration} min</td>
          <td style="padding: 8px;">${a.actualDuration} min</td>
          <td style="padding: 8px;">${analyticsIdToStudentCount[a.id] ?? 0}</td>
          <td style="padding: 8px;">${((a.finishRate ?? 0) * 100).toFixed(1)}%</td>
          <td style="padding: 8px;">${((a.lateJoinRate ?? 0) * 100).toFixed(1)}%</td>
          <td style="padding: 8px;">${((a.earlyLeaveRate ?? 0) * 100).toFixed(1)}%</td>
          <td style="padding: 8px;">${testStatus}</td>
          <td style="padding: 8px;">${a.teacherAttendance?.teacher?.name ?? '-'}</td>
        </tr>
      `;
        }).join("");

        return `
      <h3 style="margin-top: 40px; color: #02bdfe;">📘 Course: ${courseName}</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 30px;">
        <thead style="background-color: #f0f0f0;">
          <tr>
            <th style="padding: 8px;">#</th>
            <th style="padding: 8px;">Session Name</th>
            <th style="padding: 8px;">Class</th>
            <th style="padding: 8px;">Teacher Start (IST)</th>
            <th style="padding: 8px;">Teacher End (IST)</th>
            <th style="padding: 8px;">Scheduled Duration</th>
            <th style="padding: 8px;">Actual Duration</th>
            <th style="padding: 8px;">Student Attended</th>
            <th style="padding: 8px;">Finish %</th>
            <th style="padding: 8px;">Late Join %</th>
            <th style="padding: 8px;">Early Leave %</th>
            <th style="padding: 8px;">Homework Status</th>
            <th style="padding: 8px;">Teacher</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
    }).join("");

    const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #02bdfe; text-align: center;">📊 Daily Session Analytics Summary</h2>
      <p style="text-align: center;">Report for: <strong>${todayIST.toDateString()}</strong></p>
      ${courseSections}
      <p style="text-align: center; color: #888; margin-top: 30px;">
        This is an automated report from <strong style="color: #02bdfe;">SISYA CLASS</strong>
      </p>
    </div>
  `;

    await sendAnalyticsMail({
        to: ['ramki@sisyaclass.com'],
        subject: `📊 SISYA Daily Session Analytics - ${todayIST.toDateString()}`,
        html,
    });

    console.log("✅ Daily analytics email sent.");
};

export const sendDailyAnalyticsEmail2 = async () => {
    const nowIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const todayIST = new Date(nowIST);
    todayIST.setHours(0, 0, 0, 0);

    const tomorrowIST = new Date(todayIST);
    tomorrowIST.setDate(tomorrowIST.getDate() + 1);

    const todayUTC = new Date(todayIST.toUTCString());
    const tomorrowUTC = new Date(tomorrowIST.toUTCString());

    const sessions = await prisma.sessionAnalytics.findMany({
        where: {
            classStartTime: {
                gte: todayUTC,
                lt: tomorrowUTC,
            },
        },
        include: {
            session: {
                select: {
                    id: true,
                    detail: true,
                    course: { select: { name: true, grade: true } },
                    SessionTest: { select: { id: true } },
                    hostRecordingUrl: true,
                    screenRecordingUrl: true,
                },
            },
            teacherAttendance: {
                select: {
                    teacherId: true,
                    startTime: true,
                    endTime: true,
                    teacher: { select: { name: true, email: true } },
                },
            },
            studentIntervals: {
                select: {
                    studentId: true,
                    joinTime: true,
                    leaveTime: true,
                    duration: true,
                    isEarlyLeave: true,
                    isLateJoin: true,
                    student: { select: { name: true, email: true } },
                },
                orderBy: { joinTime: "asc" },
            },
        },
        orderBy: { classStartTime: "asc" },
    });

    if (!sessions.length) {
        console.log("📭 No session analytics found for today.");
        return;
    }

    const groupedByCourse = sessions.reduce((acc, s) => {
        const courseName = s.session?.course?.name ?? "Uncategorized";
        if (!acc[courseName]) acc[courseName] = [];
        acc[courseName].push(s);
        return acc;
    }, {} as Record<string, typeof sessions>);

    const courseSections = Object.entries(groupedByCourse).map(([courseName, courseSessions]) => {
        const rows = courseSessions.map((a, i) => {
            const teacherStartTime = a.teacherAttendance?.startTime
                ? new Date(a.teacherAttendance.startTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })
                : "-";
            const teacherEndTime = a.teacherAttendance?.endTime
                ? new Date(a.teacherAttendance.endTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })
                : "-";
            const testStatus = a.session?.SessionTest?.length ? "Uploaded" : "Not Uploaded";
            // const hostRecordingStatus = a.session?.hostRecordingUrl ? "✅" : "❌";
            // const screenRecordingStatus = a.session?.screenRecordingUrl ? "✅" : "❌";

            // 🧩 build student details table
            const studentMap = new Map<number, {
                name: string;
                email: string;
                totalDurationMin: number;
                isLateJoin: boolean;
                isEarlyLeave: boolean;
                intervals: { joinTime: string; leaveTime: string; durationMin: number }[];
            }>();

            for (const st of a.studentIntervals) {
                const joinStr = new Date(st.joinTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
                const leaveStr = st.leaveTime ? new Date(st.leaveTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "-";
                const durationMin = st.duration ? +(st.duration / 60).toFixed(1) : 0;

                if (!studentMap.has(st.studentId)) {
                    studentMap.set(st.studentId, {
                        name: st.student?.name ?? "-",
                        email: st.student?.email ?? "-",
                        totalDurationMin: durationMin,
                        isLateJoin: !!st.isLateJoin,
                        isEarlyLeave: !!st.isEarlyLeave,
                        intervals: [{ joinTime: joinStr, leaveTime: leaveStr, durationMin }],
                    });
                } else {
                    const existing = studentMap.get(st.studentId)!;
                    existing.totalDurationMin += durationMin;
                    existing.isLateJoin = existing.isLateJoin || !!st.isLateJoin;
                    existing.isEarlyLeave = existing.isEarlyLeave || !!st.isEarlyLeave;
                    existing.intervals.push({ joinTime: joinStr, leaveTime: leaveStr, durationMin });
                }
            }

            const studentRows = Array.from(studentMap.values()).map((s, idx) => `
                <tr>
                    <td style="padding:6px; border:1px solid #eee;">${idx + 1}</td>
                    <td style="padding:6px; border:1px solid #eee;">${s.name}</td>
                    <td style="padding:6px; border:1px solid #eee;">${s.email}</td>
                    <td style="padding:6px; border:1px solid #eee;">${s.totalDurationMin.toFixed(1)} min</td>
                    <td style="padding:6px; border:1px solid #eee;">${s.isLateJoin ? "⏰" : ""}</td>
                    <td style="padding:6px; border:1px solid #eee;">${s.isEarlyLeave ? "🚪" : ""}</td>
                </tr>
                <tr>
                    <td colspan="6" style="padding:6px 10px; background:#fafafa;">
                        <b>Intervals:</b><br/>
                        ${s.intervals.map(iv => `
                            <div style="margin-left:12px; font-size:13px;">
                                • ${iv.joinTime} → ${iv.leaveTime} (${iv.durationMin} min)
                            </div>
                        `).join("")}
                    </td>
                </tr>
            `).join("");

            return `
            <tr style="border-bottom:1px solid #ddd;">
                <td style="padding:8px; text-align:center;">${i + 1}</td>
                <td style="padding:8px;">${a.session?.detail ?? '-'}</td>
                <td style="padding:8px;">${a.session?.course?.grade ?? '-'}</td>
                <td style="padding:8px;">${teacherStartTime}</td>
                <td style="padding:8px;">${teacherEndTime}</td>
                <td style="padding:8px;">${a.scheduledDuration} min</td>
                <td style="padding:8px;">${a.actualDuration} min</td>
                <td style="padding:8px;">${studentMap.size}</td>
                <td style="padding:8px;">${((a.finishRate ?? 0) * 100).toFixed(1)}%</td>
                <td style="padding:8px;">${((a.lateJoinRate ?? 0) * 100).toFixed(1)}%</td>
                <td style="padding:8px;">${((a.earlyLeaveRate ?? 0) * 100).toFixed(1)}%</td>
                <td style="padding:8px;">${testStatus}</td>
                <td style="padding:8px;">${a.teacherAttendance?.teacher?.name ?? '-'}</td>
            </tr>
            <tr>
                <td colspan="15" style="padding:10px 20px; background:#f8f9fb;">
                    <details style="font-size:14px;">
                        <summary style="cursor:pointer; color:#02bdfe; font-weight:bold;">👩‍🎓 View Student Details (${studentMap.size})</summary>
                        <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:13px;">
                            <thead style="background:#f2f2f2;">
                                <tr>
                                    <th>#</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Total Duration</th>
                                    <th>Late</th>
                                    <th>Early Leave</th>
                                </tr>
                            </thead>
                            <tbody>${studentRows}</tbody>
                        </table>
                    </details>
                </td>
            </tr>
            `;
        }).join("");

        return `
        <h3 style="margin-top:40px; color:#02bdfe;">📘 Course: ${courseName}</h3>
        <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:30px;">
            <thead style="background:#f0f0f0;">
                <tr>
                    <th>#</th>
                    <th>Session Name</th>
                    <th>Class</th>
                    <th>Teacher Start</th>
                    <th>Teacher End</th>
                    <th>Scheduled</th>
                    <th>Actual</th>
                    <th>Students</th>
                    <th>Finish%</th>
                    <th>Late%</th>
                    <th>Early%</th>
                    <th>Homework</th>
                    <th>Teacher</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
    }).join("");

    const html = `
    <div style="font-family:Arial, sans-serif; padding:20px;">
        <h2 style="color:#02bdfe; text-align:center;">📊 Daily Session Analytics Summary</h2>
        <p style="text-align:center;">Report for: <strong>${todayIST.toDateString()}</strong></p>
        ${courseSections}
        <p style="text-align:center; color:#888; margin-top:30px;">
            This is an automated report from <strong style="color:#02bdfe;">SISYA CLASS</strong>
        </p>
    </div>`;

    await sendAnalyticsMail({
        to: ["ramki@sisyaclass.com"],
        subject: `📊 SISYA Daily Session Analytics - ${todayIST.toDateString()}`,
        html,
    });

    console.log("✅ Daily analytics email with student intervals sent.");
};

// export const sendDailyAnalyticsEmail3 = async () => {
//     const nowIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
//     const todayIST = new Date(nowIST);
//     todayIST.setHours(0, 0, 0, 0);

//     const tomorrowIST = new Date(todayIST);
//     tomorrowIST.setDate(tomorrowIST.getDate() + 1);

//     const todayUTC = new Date(todayIST.toUTCString());
//     const tomorrowUTC = new Date(tomorrowIST.toUTCString());

//     const sessions = await prisma.sessionAnalytics.findMany({
//         where: {
//             classStartTime: {
//                 gte: todayUTC,
//                 lt: tomorrowUTC,
//             },
//         },
//         include: {
//             session: {
//                 select: {
//                     id: true,
//                     detail: true,
//                     course: { select: { name: true, grade: true } },
//                     SessionTest: { select: { id: true } },
//                 },
//             },
//             teacherAttendance: {
//                 select: {
//                     teacherId: true,
//                     startTime: true,
//                     endTime: true,
//                     teacher: { select: { name: true, email: true } },
//                 },
//             },
//             studentIntervals: {
//                 select: {
//                     studentId: true,
//                     joinTime: true,
//                     leaveTime: true,
//                     duration: true,
//                     isEarlyLeave: true,
//                     isLateJoin: true,
//                     student: { select: { name: true, email: true } },
//                 },
//                 orderBy: { joinTime: "asc" },
//             },
//         },
//         orderBy: { classStartTime: "asc" },
//     });

//     if (!sessions.length) {
//         console.log("📭 No session analytics found for today.");
//         return;
//     }

//     // GROUP BY COURSE
//     const grouped: Record<string, any[]> = {};
//     for (const s of sessions) {
//         const courseName = s.session?.course?.name ?? "Uncategorized";
//         if (!grouped[courseName]) grouped[courseName] = [];
//         grouped[courseName].push(s);
//     }

//     // FORMAT DATA FOR EJS
//     const formattedData = Object.entries(grouped).map(([courseName, data]) => ({
//         name: courseName,
//         sessions: data.map((a) => {
//             // Student aggregation
//             const studentMap = new Map();

//             for (const st of a.studentIntervals) {
//                 const joinStr = new Date(st.joinTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
//                 const leaveStr = st.leaveTime
//                     ? new Date(st.leaveTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
//                     : "-";

//                 const durationMin = st.duration ? +(st.duration / 60).toFixed(1) : 0;

//                 if (!studentMap.has(st.studentId)) {
//                     studentMap.set(st.studentId, {
//                         name: st.student?.name ?? "-",
//                         email: st.student?.email ?? "-",
//                         duration: durationMin,
//                         isLate: !!st.isLateJoin,
//                         isEarly: !!st.isEarlyLeave,
//                         intervals: [{
//                             join: joinStr,
//                             leave: leaveStr,
//                             duration: durationMin
//                         }]
//                     });
//                 } else {
//                     const existing = studentMap.get(st.studentId);
//                     existing.duration += durationMin;
//                     existing.isLate = existing.isLate || !!st.isLateJoin;
//                     existing.isEarly = existing.isEarly || !!st.isEarlyLeave;
//                     existing.intervals.push({
//                         join: joinStr,
//                         leave: leaveStr,
//                         duration: durationMin
//                     });
//                 }
//             }

//             return {
//                 detail: a.session?.detail ?? "-",
//                 grade: a.session?.course?.grade ?? "-",
//                 teacherStart: a.teacherAttendance?.startTime
//                     ? new Date(a.teacherAttendance.startTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })
//                     : "-",
//                 teacherEnd: a.teacherAttendance?.endTime
//                     ? new Date(a.teacherAttendance.endTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })
//                     : "-",
//                 scheduled: a.scheduledDuration,
//                 actual: a.actualDuration,
//                 studentCount: studentMap.size,
//                 finishRate: ((a.finishRate ?? 0) * 100).toFixed(1),
//                 lateRate: ((a.lateJoinRate ?? 0) * 100).toFixed(1),
//                 earlyRate: ((a.earlyLeaveRate ?? 0) * 100).toFixed(1),
//                 homework: a.session?.SessionTest?.length ? "Uploaded" : "Not Uploaded",
//                 teacherName: a.teacherAttendance?.teacher?.name ?? "-",
//                 students: Array.from(studentMap.values())
//             };
//         })
//     }));

//     // RENDER HTML USING EJS
//     const templatePath = path.join(__dirname, "../mail/templates/dailyReport.ejs");

//     const html = await ejs.renderFile(templatePath, {
//         date: todayIST.toDateString(),
//         courses: formattedData,
//     });

//     // SEND MAIL
//     await sendAnalyticsMail({
//         to: ["ramki@sisyaclass.com"],
//         subject: `📊 SISYA Daily Session Analytics - ${todayIST.toDateString()}`,
//         html,
//     });

//     console.log("✅ Daily analytics email sent with EJS template.");
// };

export const testMail = async (_req: Request, res: Response) => {
    try {
        await sendAnalyticsMail({
            to: ["ramki@sisyaclass.com"],
            subject: "Testing Mail",
            html: `
        <h2>Here's your test email 🎯</h2>
        <p>And here's Homer Simpson for no reason:</p>
        <img src="https://media.tenor.com/B_JetO57I3IAAAAM/test-homer-simpson.gif" alt="Test Homer Simpson GIF" />
      `,
        });
        res.json({ success: true, message: "Test email sent successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: { error } });
    }
}

export const getAllAnalyticsData = async (req: Request, res: Response) => {
    try {
        const {
            from,
            to,
            courseName,
            teacherId,
            sessionId,
            exportExcel,
        }: {
            from?: string;
            to?: string;
            courseName?: string;
            teacherId?: string;
            sessionId?: string;
            exportExcel?: boolean;
        } = req.body;

        const whereClause: any = {};

        if (from || to) {
            whereClause.classStartTime = {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
            };
        }

        if (sessionId) {
            whereClause.sessionId = +sessionId;
        }

        const sessions = await prisma.sessionAnalytics.findMany({
            where: whereClause,
            include: {
                session: {
                    select: {
                        id: true,
                        detail: true,
                        course: { select: { name: true, grade: true } },
                        SessionTest: { select: { id: true } },
                    },
                },
                teacherAttendance: {
                    select: {
                        teacherId: true,
                        startTime: true,
                        endTime: true,
                        teacher: { select: { name: true, email: true } },
                    },
                },
            },
            orderBy: {
                classStartTime: "desc",
            },
        });

        let filtered = sessions;

        if (courseName) {
            filtered = filtered.filter((s) =>
                s.session?.course?.name?.toLowerCase().includes(courseName.toLowerCase())
            );
        }

        if (teacherId) {
            filtered = filtered.filter(
                (s) => s.teacherAttendance?.teacherId === +teacherId
            );
        }

        const analyticsIds = filtered.map((s) => s.id);

        const studentRecords = await prisma.studentAttendanceInterval.findMany({
            where: {
                analyticsId: { in: analyticsIds },
            },
            select: {
                analyticsId: true,
                studentId: true,
            },
        });

        const studentCountMap = new Map<string, Set<string>>();
        for (const { analyticsId, studentId } of studentRecords) {
            if (!studentCountMap.has(String(analyticsId))) {
                studentCountMap.set(String(analyticsId), new Set());
            }
            studentCountMap.get(String(analyticsId))!.add(String(studentId));
        }

        const analyticsIdToStudentCount: Record<string, number> = {};
        studentCountMap.forEach((set, id) => {
            analyticsIdToStudentCount[id] = set.size;
        });

        const rows = filtered.map((s) => ({
            Date: new Date(s.classStartTime).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
            Course: s.session?.course?.name ?? "-",
            Class: s.session?.course?.grade ?? "-",
            "Session Name": s.session?.detail ?? "-",
            "Scheduled Duration (min)": s.scheduledDuration,
            "Actual Duration (min)": s.actualDuration,
            "Student Count": analyticsIdToStudentCount[s.id] ?? 0,
            "Finish %": +(((s.finishRate ?? 0) * 100).toFixed(1)),
            "Late Join %": +(((s.lateJoinRate ?? 0) * 100).toFixed(1)),
            "Early Leave %": +(((s.earlyLeaveRate ?? 0) * 100).toFixed(1)),
            "Homework Status": s.session?.SessionTest?.length ? "Uploaded" : "Not Uploaded",
            "Teacher Name": s.teacherAttendance?.teacher?.name ?? "-",
            "Teacher Email": s.teacherAttendance?.teacher?.email ?? "-",
            "Teacher Start Time (IST)": s.teacherAttendance?.startTime?.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
            }) ?? "-",
            "Teacher End Time (IST)": s.teacherAttendance?.endTime?.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
            }) ?? "-",
        }));

        if (exportExcel) {
            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Session Analytics");

            const buffer = XLSX.write(workbook, {
                bookType: "xlsx",
                type: "buffer",
            });

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="analytics_${Date.now()}.xlsx"`
            );
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            return res.status(200).send(buffer);
        }

        return res.status(200).json({
            success: true,
            data: rows,
        });
    } catch (error) {
        console.error("Error fetching analytics:", error);
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
};

export const getAllAnalyticsData2 = async (req: Request, res: Response) => {
    try {
        const {
            from,
            to,
            courseName,
            teacherId,
            sessionId,
            exportExcel,
        }: {
            from?: string;
            to?: string;
            courseName?: string;
            teacherId?: string;
            sessionId?: string;
            exportExcel?: boolean;
        } = req.body;

        const whereClause: any = {};

        if (from || to) {
            whereClause.classStartTime = {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
            };
        }

        if (sessionId) {
            whereClause.sessionId = +sessionId;
        }

        console.log("▶️ Fetching analytics with filter:", whereClause);

        const sessions = await prisma.sessionAnalytics.findMany({
            where: whereClause,
            include: {
                session: {
                    select: {
                        id: true,
                        detail: true,
                        course: { select: { name: true, grade: true } },
                        SessionTest: { select: { id: true } },
                    },
                },
                teacherAttendance: {
                    select: {
                        teacherId: true,
                        startTime: true,
                        endTime: true,
                        teacher: { select: { name: true, email: true } },
                    },
                },
                studentIntervals: {
                    select: {
                        studentId: true,
                        joinTime: true,
                        leaveTime: true,
                        duration: true,
                        isEarlyLeave: true,
                        isLateJoin: true,
                        student: { select: { name: true, email: true, phone: true } },
                    },
                    orderBy: { joinTime: "asc" },
                },
            },
            orderBy: { classStartTime: "desc" },
        });

        console.log(`✅ Found ${sessions.length} analytics records`);

        let filtered = sessions;

        if (courseName) {
            filtered = filtered.filter((s) =>
                s.session?.course?.name?.toLowerCase().includes(courseName.toLowerCase())
            );
        }

        if (teacherId) {
            filtered = filtered.filter(
                (s) => s.teacherAttendance?.teacherId === +teacherId
            );
        }

        const missingInfoSummary = {
            noSession: 0,
            noCourse: 0,
            noTeacherAttendance: 0,
            noTeacher: 0,
        };

        const sessionDetails = filtered.map((s) => {
            if (!s.session) missingInfoSummary.noSession++;
            if (s.session && !s.session.course) missingInfoSummary.noCourse++;
            if (!s.teacherAttendance) missingInfoSummary.noTeacherAttendance++;
            if (s.teacherAttendance && !s.teacherAttendance.teacher)
                missingInfoSummary.noTeacher++;

            // 🧮 Combine multiple intervals per student (now using minutes)
            const studentMap = new Map<
                number,
                {
                    name: string;
                    email: string;
                    phone: string;
                    earliestJoin: Date | null;
                    latestLeave: Date | null;
                    totalDurationMin: number; // minutes
                    isEarlyLeave: boolean;
                    isLateJoin: boolean;
                    intervals: {
                        joinTime: string;
                        leaveTime: string;
                        durationMin: number; // minutes (1 decimal)
                    }[];
                }
            >();

            for (const st of s.studentIntervals) {
                // format join / leave strings in IST
                const joinTimeStr = new Date(st.joinTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
                const leaveTimeStr = st.leaveTime
                    ? new Date(st.leaveTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                    : "-";

                // compute duration in minutes (1 decimal). Prefer st.duration if available (assumed seconds).
                let durationMin: number;
                if (typeof st.duration === "number") {
                    // convert seconds -> minutes
                    durationMin = Number(((st.duration ?? 0) / 60).toFixed(1));
                } else if (st.leaveTime && st.joinTime) {
                    // fallback: compute from timestamps (ms -> minutes)
                    const diffMs = new Date(st.leaveTime).getTime() - new Date(st.joinTime).getTime();
                    durationMin = Number((diffMs / 1000 / 60).toFixed(1));
                } else {
                    durationMin = 0;
                }

                const existing = studentMap.get(st.studentId);
                const intervalObj = {
                    joinTime: joinTimeStr,
                    leaveTime: leaveTimeStr,
                    durationMin,
                };

                if (!existing) {
                    studentMap.set(st.studentId, {
                        name: st.student?.name ?? "-",
                        email: st.student?.email ?? "-",
                        phone: st.student?.phone ?? "-",
                        earliestJoin: st.joinTime,
                        latestLeave: st.leaveTime ?? null,
                        totalDurationMin: durationMin,
                        isEarlyLeave: !!st.isEarlyLeave,
                        isLateJoin: !!st.isLateJoin,
                        intervals: [intervalObj],
                    });
                } else {
                    // earliest join
                    existing.earliestJoin =
                        existing.earliestJoin && st.joinTime
                            ? new Date(
                                Math.min(
                                    existing.earliestJoin.getTime(),
                                    st.joinTime.getTime()
                                )
                            )
                            : existing.earliestJoin ?? st.joinTime;

                    // latest leave
                    if (st.leaveTime) {
                        existing.latestLeave =
                            existing.latestLeave && st.leaveTime
                                ? new Date(
                                    Math.max(
                                        existing.latestLeave.getTime(),
                                        st.leaveTime.getTime()
                                    )
                                )
                                : st.leaveTime;
                    }

                    // accumulate minutes
                    existing.totalDurationMin += durationMin;

                    // merge flags
                    existing.isEarlyLeave =
                        existing.isEarlyLeave || !!st.isEarlyLeave;
                    existing.isLateJoin =
                        existing.isLateJoin || !!st.isLateJoin;

                    // push interval
                    existing.intervals.push(intervalObj);
                }
            }

            const students = Array.from(studentMap.entries()).map(([studentId, data]) => ({
                studentId,
                name: data.name,
                email: data.email,
                joinTime: data.earliestJoin
                    ? new Date(data.earliestJoin).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                    : "-",
                leaveTime: data.latestLeave
                    ? new Date(data.latestLeave).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                    : "-",
                totalDurationMin: Number(data.totalDurationMin.toFixed(1)),
                isEarlyLeave: data.isEarlyLeave,
                isLateJoin: data.isLateJoin,
                intervals: data.intervals, // intervals with durationMin in minutes
            }));

            const studentCount = students.length;
            const earlyLeaveCount = students.filter((s) => s.isEarlyLeave).length;
            const lateJoinCount = students.filter((s) => s.isLateJoin).length;

            return {
                analyticsId: s.id,
                sessionId: s.sessionId,
                Date: new Date(s.classStartTime).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
                Course: s.session?.course?.name ?? "-",
                Class: s.session?.course?.grade ?? "-",
                "Session Name": s.session?.detail ?? "-",
                "Scheduled Duration (min)": s.scheduledDuration,
                "Actual Duration (min)": s.actualDuration,
                "Student Count": studentCount,
                "Finish %": +(((s.finishRate ?? 0) * 100).toFixed(1)),
                "Late Join %": +(((s.lateJoinRate ?? 0) * 100).toFixed(1)),
                "Early Leave %": +(((s.earlyLeaveRate ?? 0) * 100).toFixed(1)),
                "Homework Status": s.session?.SessionTest?.length ? "Uploaded" : "Not Uploaded",
                "Teacher Name": s.teacherAttendance?.teacher?.name ?? "-",
                "Teacher Email": s.teacherAttendance?.teacher?.email ?? "-",
                "Teacher Start Time (IST)": s.teacherAttendance?.startTime?.toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                }) ?? "-",
                "Teacher End Time (IST)": s.teacherAttendance?.endTime?.toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                }) ?? "-",
                StudentDetails: students,
                Summary: {
                    EarlyLeavers: earlyLeaveCount,
                    LateJoiners: lateJoinCount,
                    AverageDurationMin:
                        studentCount > 0
                            ? (
                                students.reduce((sum, st) => sum + (st.totalDurationMin ?? 0), 0) /
                                studentCount
                            ).toFixed(1)
                            : "0.0",
                },
            };
        });

        console.log("🔍 Missing Data Summary:");
        console.table(missingInfoSummary);

        // ⚡ Export Excel if requested
        if (exportExcel) {
            const rowsForExcel = sessionDetails.flatMap((s) =>
                s.StudentDetails.map((st) => ({
                    Date: s.Date,
                    Course: s.Course,
                    Class: s.Class,
                    "Session Name": s["Session Name"],
                    "Teacher Name": s["Teacher Name"],
                    "Teacher Email": s["Teacher Email"],
                    "Student Name": st.name,
                    "Student Email": st.email,
                    "Join Time (IST)": st.joinTime,
                    "Leave Time (IST)": st.leaveTime,
                    "Total Duration (min)": st.totalDurationMin,
                    "Late Join": st.isLateJoin ? "Yes" : "No",
                    "Early Leave": st.isEarlyLeave ? "Yes" : "No",
                }))
            );

            const worksheet = XLSX.utils.json_to_sheet(rowsForExcel);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Session Analytics");
            const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="analytics_${Date.now()}.xlsx"`
            );
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            return res.status(200).send(buffer);
        }

        return res.status(200).json({
            success: true,
            data: sessionDetails,
        });
    } catch (error) {
        console.error("❌ Error fetching analytics:", error);
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
};

export const getAllAnalyticsData3 = async (req: Request, res: Response) => {
    try {
        const {
            from,
            to,
            courseName,
            teacherId,
            sessionId,
            exportExcel,
        } = req.body;

        const whereClause: any = {};

        if (from || to) {
            whereClause.classStartTime = {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
            };
        }

        if (sessionId) {
            whereClause.sessionId = Number(sessionId);
        }

        console.log("Fetching analytics with filter:", whereClause);

        const analytics = await prisma.sessionAnalytics.findMany({
            where: whereClause,
            include: {
                session: {
                    include: {
                        course: { select: { name: true, grade: true } },
                        SessionTest: {
                            include: {
                                sessionTestQuestion: true,
                            },
                        },
                    },
                },
                teacherAttendance: {
                    include: {
                        teacher: true,
                    },
                },
                studentIntervals: {
                    include: {
                        student: true,
                    },
                    orderBy: { joinTime: "asc" },
                },
            },
            orderBy: { classStartTime: "desc" },
        });

        console.log(`Found ${analytics.length} analytics records`);

        let filtered = analytics;

        if (courseName) {
            filtered = filtered.filter((s) =>
                s.session?.course?.name
                    ?.toLowerCase()
                    .includes(courseName.toLowerCase())
            );
        }

        if (teacherId) {
            filtered = filtered.filter(
                (s) => s.teacherAttendance?.teacherId === Number(teacherId)
            );
        }

        const allTestIds = filtered.flatMap((s) =>
            s.session?.SessionTest?.map((t) => t.id) ?? []
        );

        let testSubmissionsByTestId: Record<number, any[]> = {};

        if (allTestIds.length > 0) {
            console.log("Fetching homework submissions for tests:", allTestIds.length);

            const submissions = await prisma.sessionTestSubmission.findMany({
                where: { sessionTestId: { in: allTestIds } },
                include: {
                    sessionTestResponse: {
                        include: {
                            forQuestion: true,
                        },
                    },
                },
            });

            testSubmissionsByTestId = submissions.reduce((acc, sub) => {
                if (!acc[sub.sessionTestId]) acc[sub.sessionTestId] = [];
                acc[sub.sessionTestId].push(sub);
                return acc;
            }, {} as Record<number, any[]>);
        }

        const sessionDetails = filtered.map((s) => {

            const studentMap = new Map<
                number,
                {
                    name: string;
                    email: string;
                    phone: string;
                    earliestJoin: Date | null;
                    latestLeave: Date | null;
                    totalDurationMin: number;
                    isEarlyLeave: boolean;
                    isLateJoin: boolean;
                    intervals: { joinTime: string; leaveTime: string; durationMin: number }[];
                    homework?: any;
                }
            >();

            for (const st of s.studentIntervals) {
                const durMin = st.duration
                    ? Number((st.duration / 60).toFixed(1))
                    : st.leaveTime
                        ? Number(
                            ((new Date(st.leaveTime).getTime() -
                                new Date(st.joinTime).getTime()) /
                                60000).toFixed(1)
                        )
                        : 0;

                const joinStr = new Date(st.joinTime).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                });
                const leaveStr = st.leaveTime
                    ? new Date(st.leaveTime).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                    })
                    : "-";

                const existing = studentMap.get(st.studentId);

                if (!existing) {
                    studentMap.set(st.studentId, {
                        name: st.student?.name ?? "-",
                        email: st.student?.email ?? "-",
                        phone: st.student?.phone ?? "-",
                        earliestJoin: st.joinTime,
                        latestLeave: st.leaveTime ?? null,
                        totalDurationMin: durMin,
                        isEarlyLeave: !!st.isEarlyLeave,
                        isLateJoin: !!st.isLateJoin,
                        intervals: [{ joinTime: joinStr, leaveTime: leaveStr, durationMin: durMin }],
                    });
                } else {
                    existing.totalDurationMin += durMin;
                    existing.intervals.push({
                        joinTime: joinStr,
                        leaveTime: leaveStr,
                        durationMin: durMin,
                    });

                    if (
                        st.joinTime &&
                        existing.earliestJoin &&
                        new Date(st.joinTime) < new Date(existing.earliestJoin)
                    ) {
                        existing.earliestJoin = st.joinTime;
                    }

                    if (
                        st.leaveTime &&
                        (!existing.latestLeave ||
                            new Date(st.leaveTime) > new Date(existing.latestLeave))
                    ) {
                        existing.latestLeave = st.leaveTime;
                    }

                    existing.isEarlyLeave ||= !!st.isEarlyLeave;
                    existing.isLateJoin ||= !!st.isLateJoin;
                }
            }

            const tests = s.session?.SessionTest ?? [];

            for (const [studentId, data] of studentMap.entries()) {
                let finalSubmission = null;

                for (const test of tests) {
                    const submissions = testSubmissionsByTestId[test.id] ?? [];

                    const match = submissions.find((sub) => sub.endUsersId === studentId);

                    if (match) {
                        finalSubmission = match;
                        break;
                    }
                }

                if (!finalSubmission) {
                    data["homework"] = {
                        submitted: false,
                        score: 0,
                        totalQuestions: tests[0]?.sessionTestQuestion?.length ?? 0,
                    };
                } else {
                    let score = 0;
                    finalSubmission.sessionTestResponse.forEach((resp) => {
                        if (resp.response === resp.forQuestion.correctResponse) score++;
                    });

                    data["homework"] = {
                        submitted: true,
                        score,
                        totalQuestions: finalSubmission.sessionTestResponse.length,
                        responses: finalSubmission.sessionTestResponse.map((r) => ({
                            question: r.forQuestion.question,
                            correctResponse: r.forQuestion.correctResponse,
                            response: r.response,
                        })),
                    };
                }
            }

            const students = Array.from(studentMap.entries()).map(([id, d]) => ({
                studentId: id,
                name: d.name,
                email: d.email,
                phone: d.phone,
                joinTime: d.earliestJoin
                    ? new Date(d.earliestJoin).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                    : "-",
                leaveTime: d.latestLeave
                    ? new Date(d.latestLeave).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                    : "-",
                totalDurationMin: Number(d.totalDurationMin.toFixed(1)),
                isEarlyLeave: d.isEarlyLeave,
                isLateJoin: d.isLateJoin,
                intervals: d.intervals,
                homework: d.homework,
            }));

            const studentCount = students.length;

            return {
                analyticsId: s.id,
                sessionId: s.sessionId,
                Date: new Date(s.classStartTime).toLocaleDateString("en-IN", {
                    timeZone: "Asia/Kolkata",
                }),
                Course: s.session?.course?.name ?? "-",
                Class: s.session?.course?.grade ?? "-",
                "Session Name": s.session?.detail ?? "-",
                "Scheduled Duration (min)": s.scheduledDuration,
                "Actual Duration (min)": s.actualDuration,
                "Student Count": studentCount,
                "Finish %": Number(((s.finishRate ?? 0) * 100).toFixed(1)),
                "Late Join %": Number(((s.lateJoinRate ?? 0) * 100).toFixed(1)),
                "Early Leave %": Number(((s.earlyLeaveRate ?? 0) * 100).toFixed(1)),
                "Homework Status": tests.length > 0 ? "Uploaded" : "Not Uploaded",
                "Teacher Name": s.teacherAttendance?.teacher?.name ?? "-",
                "Teacher Email": s.teacherAttendance?.teacher?.email ?? "-",
                StudentDetails: students,
            };
        });

        if (exportExcel) {
            const rows = sessionDetails.flatMap((s) =>
                s.StudentDetails.map((st) => ({
                    Date: s.Date,
                    Course: s.Course,
                    Class: s.Class,
                    "Session Name": s["Session Name"],
                    "Teacher Name": s["Teacher Name"],
                    "Teacher Email": s["Teacher Email"],
                    "Student Name": st.name,
                    "Student Email": st.email,
                    "Student Phone": st.phone,
                    "Join Time (IST)": st.joinTime,
                    "Leave Time (IST)": st.leaveTime,
                    "Total Duration (min)": st.totalDurationMin,
                    "Late Join": st.isLateJoin ? "Yes" : "No",
                    "Early Leave": st.isEarlyLeave ? "Yes" : "No",
                    "Homework Submitted": st.homework.submitted ? "Yes" : "No",
                    "Homework Score": st.homework.score,
                    "Homework Total Q": st.homework.totalQuestions,
                }))
            );

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Analytics");

            const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

            res.setHeader("Content-Disposition", `attachment; filename="analytics_${Date.now()}.xlsx"`);
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            return res.status(200).send(buffer);
        }

        return res.status(200).json({ success: true, data: sessionDetails });
    } catch (error) {
        console.error("Error fetching analytics:", error);
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
};


export async function postStudentDailyAnalytics(req: Request, res: Response) {
    try {
        const { studentId } = req.body;

        if (!studentId || isNaN(Number(studentId))) {
            return res.status(400).json({ error: "Invalid or missing studentId" });
        }

        // Fetch all intervals for the student
        const intervals = await prisma.studentAttendanceInterval.findMany({
            where: { studentId: Number(studentId) },
            orderBy: { joinTime: "asc" },
        });

        // Group by date
        const groupedByDate: Record<string, any> = {};

        intervals.forEach((row) => {
            const dateKey = row.joinTime.toISOString().split("T")[0]; // YYYY-MM-DD
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = {
                    date: dateKey,
                    totalDuration: 0,
                    intervals: [],
                };
            }

            groupedByDate[dateKey].totalDuration += row.duration || 0;
            groupedByDate[dateKey].intervals.push({
                joinTime: row.joinTime,
                leaveTime: row.leaveTime,
                duration: row.duration,
                isLateJoin: row.isLateJoin,
                isEarlyLeave: row.isEarlyLeave,
            });
        });

        // Prepare final analytics
        const dailyAnalytics = Object.values(groupedByDate).map((day: any) => {
            // Sort intervals by joinTime for correct first/last detection
            day.intervals.sort((a: any, b: any) => a.joinTime.getTime() - b.joinTime.getTime());

            const firstInterval = day.intervals[0];
            const lastInterval = day.intervals[day.intervals.length - 1];

            return {
                date: day.date,
                totalDuration: day.totalDuration,
                totalDurationMinutes: Math.round(day.totalDuration / 60),
                sessionCount: day.intervals.length,
                lateJoin: firstInterval?.isLateJoin || false,
                earlyLeave: lastInterval?.isEarlyLeave || false,
                intervals: day.intervals,
                averageSessionDurationMinutes:
                    day.intervals.length > 0
                        ? Math.round(day.totalDuration / day.intervals.length / 60)
                        : 0,
            };
        });

        res.json({
            studentId: Number(studentId),
            totalDays: dailyAnalytics.length,
            totalSessions: intervals.length,
            totalDurationMinutes: Math.round(
                intervals.reduce((sum, r) => sum + (r.duration || 0), 0) / 60
            ),
            dailyAnalytics,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Something went wrong" });
    }
}

export async function getStudentCourseAttendance(req: Request, res: Response) {
    try {
        let { studentId, courseId } = req.body;
        studentId = parseInt(studentId, 10);
        courseId = parseInt(courseId, 10);

        if (isNaN(studentId) || isNaN(courseId)) {
            return res.status(400).json({ error: "Invalid studentId or courseId" });
        }

        // 1. Get all sessions for this course
        const sessions = await prisma.session.findMany({
            where: { bigCourseId: courseId },
            include: {
                analytics: true,
            },
            orderBy: { startTime: "asc" },
        });

        // 2. Get all attendance intervals for this student across sessions
        const intervals = await prisma.studentAttendanceInterval.findMany({
            where: {
                studentId,
                sessionAnalytics: {
                    session: { bigCourseId: courseId },
                },
            },
            include: {
                sessionAnalytics: true,
            },
            orderBy: { joinTime: "asc" },
        });

        // 3. Group intervals by sessionId
        const grouped: Record<number, any> = {};

        for (const interval of intervals) {
            const sid = interval.sessionAnalytics.sessionId!;
            if (!grouped[sid]) {
                grouped[sid] = {
                    sessionId: sid,
                    intervals: [],
                    firstJoinTime: interval.joinTime,
                    lastLeaveTime: interval.leaveTime,
                    totalDuration: interval.duration ?? 0,
                    isEarlyLeave: false,
                    isLateJoin: false,
                };
            } else {
                if (interval.joinTime < grouped[sid].firstJoinTime) {
                    grouped[sid].firstJoinTime = interval.joinTime;
                }
                if (
                    interval.leaveTime &&
                    (!grouped[sid].lastLeaveTime ||
                        interval.leaveTime > grouped[sid].lastLeaveTime)
                ) {
                    grouped[sid].lastLeaveTime = interval.leaveTime;
                }
                grouped[sid].totalDuration += interval.duration ?? 0;
            }

            // Push interval detail
            grouped[sid].intervals.push({
                joinTime: interval.joinTime,
                leaveTime: interval.leaveTime,
                duration: interval.duration,
            });

            // Update overall flags
            if (interval.isEarlyLeave) grouped[sid].isEarlyLeave = true;
            if (interval.isLateJoin) grouped[sid].isLateJoin = true;
        }

        // 4. Merge with sessions list
        const result = sessions.map((s) => {
            const att = grouped[s.id];
            const actualStart = s.analytics?.classStartTime || s.startTime;
            const actualEnd = s.analytics?.classEndTime || s.endTime;
            if (!att) {
                return {
                    sessionId: s.id,
                    detail: s.detail,
                    startTime: actualStart,
                    endTime: actualEnd,
                    status: "Absent",
                };
            }
            return {
                sessionId: s.id,
                detail: s.detail,
                startTime: actualStart,
                endTime: actualEnd,
                status: "Present",
                firstJoinTime: att.firstJoinTime,
                lastLeaveTime: att.lastLeaveTime,
                totalDuration: att.totalDuration,
                isEarlyLeave: att.isEarlyLeave,
                isLateJoin: att.isLateJoin,
                intervals: att.intervals,
            };
        });

        return res.json(result);
    } catch (error) {
        console.error("Error fetching course attendance:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export const getSessionStudentAnalyticsWithAbsent = async (
    req: Request,
    res: Response
) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: "sessionId is required",
            });
        }

        const analytics = await prisma.sessionAnalytics.findUnique({
            where: {
                sessionId: Number(sessionId),
            },
            select: {
                sessionId: true,
                session: {
                    select: {
                        bigCourseId: true,
                    },
                },
                studentIntervals: {
                    select: {
                        studentId: true,
                        joinTime: true,
                        leaveTime: true,
                        duration: true,
                        isEarlyLeave: true,
                        isLateJoin: true,
                        student: {
                            select: {
                                name: true,
                                email: true,
                                phone: true,
                                isActive: true,
                                isSisyaEmp: true, 
                            },
                        },
                    },
                    orderBy: {
                        joinTime: "asc",
                    },
                },
            },
        });

        if (!analytics || !analytics.session) {
            return res.status(404).json({
                success: false,
                error: "Analytics or Session not found",
            });
        }

        const courseId = analytics.session.bigCourseId;

        const subscriptions = await prisma.mgSubsciption.findMany({
            where: {
                bigCourseId: courseId,
                isActive: true,
                user: {
                    isActive: true,
                    isSisyaEmp: false, 
                },
            },
            select: {
                endUsersId: true,
                user: {
                    select: {
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
            },
        });

        const presentMap = new Map<number, any>();

        for (const st of analytics.studentIntervals) {
            if (
                !st.student ||
                st.student.isActive === false ||
                st.student.isSisyaEmp === true 
            ) {
                continue;
            }

            let durationMin = 0;

            if (typeof st.duration === "number") {
                durationMin = Number((st.duration / 60).toFixed(1));
            } else if (st.leaveTime) {
                const diff =
                    new Date(st.leaveTime).getTime() -
                    new Date(st.joinTime).getTime();
                durationMin = Number((diff / 1000 / 60).toFixed(1));
            }

            const existing = presentMap.get(st.studentId);

            if (!existing) {
                presentMap.set(st.studentId, {
                    studentId: st.studentId,
                    name: st.student?.name ?? "-",
                    email: st.student?.email ?? "-",
                    phone: st.student?.phone ?? "-",

                    status: "PRESENT",

                    totalDurationMin: durationMin,
                    isEarlyLeave: !!st.isEarlyLeave,
                    isLateJoin: !!st.isLateJoin,

                    intervals: [
                        {
                            joinTime: st.joinTime,
                            leaveTime: st.leaveTime,
                            durationMin,
                        },
                    ],
                });
            } else {
                existing.totalDurationMin += durationMin;
                existing.isEarlyLeave ||= !!st.isEarlyLeave;
                existing.isLateJoin ||= !!st.isLateJoin;

                existing.intervals.push({
                    joinTime: st.joinTime,
                    leaveTime: st.leaveTime,
                    durationMin,
                });
            }
        }

        const finalStudents: any[] = [];

        for (const sub of subscriptions) {
            const studentId = sub.endUsersId;

            const presentStudent = presentMap.get(studentId);

            if (presentStudent) {
                finalStudents.push(presentStudent);
            } else {
                finalStudents.push({
                    studentId,
                    name: sub.user.name ?? "-",
                    email: sub.user.email ?? "-",
                    phone: sub.user.phone ?? "-",

                    status: "ABSENT",

                    totalDurationMin: 0,
                    isEarlyLeave: false,
                    isLateJoin: false,
                    intervals: [],
                });
            }
        }

        const presentCount = finalStudents.filter(
            (s) => s.status === "PRESENT"
        ).length;

        const absentCount = finalStudents.filter(
            (s) => s.status === "ABSENT"
        ).length;

        return res.status(200).json({
            success: true,
            sessionId,
            totalEnrolled: subscriptions.length,
            presentCount,
            absentCount,
            students: finalStudents,
        });
    } catch (error) {
        console.error("Session Attendance Error:", error);

        return res.status(500).json({
            success: false,
            error: "Internal Server Error",
        });
    }
};


