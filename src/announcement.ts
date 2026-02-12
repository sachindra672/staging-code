import { Request, Response } from "express";
import { prisma } from "./misc";

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

export class AnnouncementController {
    // static async createAnnouncement(payload: any, isInternal: boolean = false) {
    //     try {
    //         const {
    //             title,
    //             message,
    //             type = "GENERAL",
    //             status = "SENT",
    //             audience = "ALL_USERS",
    //             scope = "GLOBAL",
    //             courseId,
    //             classId,
    //             userId,
    //             mentorId,
    //             sendPush = true,
    //             sendInApp = true,
    //             imageUrl,
    //             actionType,
    //             actionTarget,
    //             actionData,
    //             tokens = [],
    //             scheduledAt
    //         } = payload;

    //         const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();
    //         const initialStatus = isScheduled ? "SCHEDULED" : (status || "SENT");

    //         console.log("in body", { mentorId });

    //         // 1. Create announcement record in DB
    //         const announcement = await prisma.announcement.create({
    //             data: {
    //                 title,
    //                 message,
    //                 type,
    //                 status: initialStatus,
    //                 audience,
    //                 scope,
    //                 courseId,
    //                 classId,
    //                 userId,
    //                 mentorId,
    //                 sendPush,
    //                 sendInApp,
    //                 imageUrl,
    //                 actionType,
    //                 actionTarget,
    //                 actionData,
    //                 scheduledAt: isScheduled ? new Date(scheduledAt) : null,
    //                 sentAt: !isScheduled ? new Date() : null
    //             }
    //         });

    //         if (!isScheduled) {
    //             await AnnouncementController.sendAnnouncementNotifications(announcement, tokens);
    //         }

    //         if (isInternal) {
    //             return { success: true, data: announcement };
    //         }

    //         return { status: 200, json: { success: true, data: announcement } };

    //     } catch (error: any) {
    //         console.error("Error creating announcement:", error);
    //         if (isInternal) {
    //             throw error;
    //         }
    //         return { status: 500, json: { success: false, message: error.message } };
    //     }
    // }

    // static async sendAnnouncementNotifications(announcement: any, tokens: string[] = []) {
    //     try {
    //         const {
    //             id,
    //             title,
    //             message,
    //             audience,
    //             scope,
    //             courseId,
    //             classId,
    //             userId,
    //             mentorId,
    //             sendPush,
    //             sendInApp,
    //             imageUrl,
    //             actionType,
    //             actionTarget,
    //             actionData,
    //             type
    //         } = announcement;

    //         // 1. Token Collection based on Audience and Scope
    //         const targetTokensSet: Set<string> = new Set(tokens || []);

    //         if (targetTokensSet.size === 0 && (sendPush || sendInApp)) {
    //             const includeStudents = audience === "ALL_USERS" || audience === "STUDENTS";
    //             const includeTeachers = audience === "ALL_USERS" || audience === "TEACHERS";

    //             console.log({ includeTeachers, scope, mentorId })

    //             if (includeStudents) {
    //                 if (scope === "GLOBAL") {
    //                     const students = await prisma.endUsers.findMany({ where: { isActive: true }, select: { deviceId: true } });
    //                     students.forEach(s => s.deviceId && targetTokensSet.add(s.deviceId));
    //                 } else if (scope === "COURSE" && courseId) {
    //                     const subscriptions = await prisma.mgSubsciption.findMany({
    //                         where: { bigCourseId: courseId, isActive: true },
    //                         select: { user: { select: { deviceId: true } } }
    //                     });
    //                     subscriptions.forEach(s => s.user.deviceId && targetTokensSet.add(s.user.deviceId));
    //                 } else if (scope === "CLASS" && classId) {
    //                     const students = await prisma.endUsers.findMany({
    //                         where: { grade: classId.toString(), isActive: true },
    //                         select: { deviceId: true }
    //                     });
    //                     students.forEach(s => s.deviceId && targetTokensSet.add(s.deviceId));
    //                 } else if (scope === "INDIVIDUAL" && userId) {
    //                     const student = await prisma.endUsers.findUnique({ where: { id: userId }, select: { deviceId: true } });
    //                     student?.deviceId && targetTokensSet.add(student.deviceId);
    //                 } else if (scope === "INDIVIDUAL" && mentorId) {
    //                     const mentor = await prisma.mentor.findUnique({ where: { id: mentorId }, select: { deviceId: true, mobileDeviceId: true } });
    //                     if (mentor) {
    //                         mentor.deviceId && targetTokensSet.add(mentor.deviceId);
    //                         mentor.mobileDeviceId && targetTokensSet.add(mentor.mobileDeviceId);
    //                     }
    //                 }
    //             }

    //             if (includeTeachers) {
    //                 if (scope === "GLOBAL") {
    //                     const mentors = await prisma.mentor.findMany({ where: { isActive: true }, select: { deviceId: true, mobileDeviceId: true } });
    //                     mentors.forEach(m => {
    //                         m.deviceId && targetTokensSet.add(m.deviceId);
    //                         m.mobileDeviceId && targetTokensSet.add(m.mobileDeviceId);
    //                     });
    //                 } else if (scope === "COURSE" && courseId) {
    //                     const course = await prisma.bigCourse.findUnique({ where: { id: courseId }, select: { mentorList: true } });
    //                     if (course?.mentorList) {
    //                         const mentors = await prisma.mentor.findMany({
    //                             where: { id: { in: course.mentorList }, isActive: true },
    //                             select: { deviceId: true, mobileDeviceId: true }
    //                         });
    //                         mentors.forEach(m => {
    //                             m.deviceId && targetTokensSet.add(m.deviceId);
    //                             m.mobileDeviceId && targetTokensSet.add(m.mobileDeviceId);
    //                         });
    //                     }
    //                 } else if (scope === "CLASS" && classId) {
    //                     const mentors = await prisma.mentor.findMany({
    //                         where: { Grades: { has: classId.toString() }, isActive: true },
    //                         select: { deviceId: true, mobileDeviceId: true }
    //                     });
    //                     mentors.forEach(m => {
    //                         m.deviceId && targetTokensSet.add(m.deviceId);
    //                         m.mobileDeviceId && targetTokensSet.add(m.mobileDeviceId);
    //                     });
    //                 } else if (scope === "INDIVIDUAL" && mentorId) {
    //                     console.log("have")
    //                     const mentor = await prisma.mentor.findUnique({ where: { id: +mentorId }, select: { deviceId: true, mobileDeviceId: true } });
    //                     console.log("sending teacher", mentorId, { mentor })
    //                     if (mentor) {
    //                         mentor.deviceId && targetTokensSet.add(mentor.deviceId);
    //                         mentor.mobileDeviceId && targetTokensSet.add(mentor.mobileDeviceId);
    //                     }
    //                 } else if (scope === "INDIVIDUAL" && userId) {
    //                     const mentor = await prisma.mentor.findUnique({ where: { id: userId }, select: { deviceId: true, mobileDeviceId: true } });
    //                     if (mentor) {
    //                         mentor.deviceId && targetTokensSet.add(mentor.deviceId);
    //                         mentor.mobileDeviceId && targetTokensSet.add(mentor.mobileDeviceId);
    //                     }
    //                 }
    //             }
    //         }

    //         const finalTokens = Array.from(targetTokensSet).filter(Boolean);

    //         // 2. Handle Notifications (Push and In-App)
    //         console.log({ sendPush, sendInApp, "length": finalTokens.length })
    //         if ((sendPush || sendInApp) && finalTokens.length > 0) {
    //             const response = await fetch("http://127.0.0.1:4004/", {
    //                 method: "POST",
    //                 body: JSON.stringify({
    //                     tokens: finalTokens,
    //                     data: {
    //                         id,
    //                         title: title ?? "",
    //                         body: message ?? "",
    //                         imageUrl: imageUrl ?? "",
    //                         category: "ANNOUNCEMENT",
    //                         type,
    //                         actionType: actionType ?? "NONE",
    //                         actionTarget: actionTarget ?? "",
    //                         actionData: actionData ? JSON.stringify(actionData) : "",
    //                     }
    //                 }),
    //                 headers: { "Content-Type": "application/json" }
    //             }).then(res => res.text());

    //             console.log("Notification Service Response:", response);
    //         }

    //         // 3. Update Status and sentAt
    //         await prisma.announcement.update({
    //             where: { id },
    //             data: {
    //                 status: "SENT",
    //                 sentAt: new Date(),
    //                 totalSent: finalTokens.length
    //             }
    //         });

    //     } catch (error) {
    //         console.error("Error sending announcement notifications:", error);
    //         throw error;
    //     }
    // }

    // Express Route Handler Wrapper
    static async createAnnouncement(payload: any, isInternal: boolean = false) {
        try {

            const {
                title,
                message,
                type = "GENERAL",
                status = "SENT",
                audience = "ALL_USERS",
                scope = "GLOBAL",

                courseId,
                classId,
                userId,
                mentorId,

                courseIds = [],
                classIds = [],

                sendPush = true,
                sendInApp = true,

                imageUrl,
                actionType,
                actionTarget,
                actionData,
                tokens = [],
                scheduledAt
            } = payload;

            const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();
            const initialStatus = isScheduled ? "SCHEDULED" : status;

            // ----------------------------------
            // Build targets (MULTI ROW SUPPORT)
            // ----------------------------------

            let targets: any[] = [];

            if (scope === "COURSE" && courseIds.length) {

                targets = [...new Set(courseIds)].map((id: unknown) => ({
                    courseId: id as number,
                    classId: null,
                    userId: null,
                    mentorId: null
                }));

            } else if (scope === "CLASS" && classIds.length) {

                targets = [...new Set(classIds)].map((id: unknown) => ({
                    classId: id as number,
                    courseId: null,
                    userId: null,
                    mentorId: null
                }));

            } else {

                targets = [{
                    courseId,
                    classId,
                    userId,
                    mentorId
                }];

            }

            // ----------------------------------
            // Create rows in transaction
            // ----------------------------------

            const createdAnnouncements = await prisma.$transaction(

                targets.map(target =>

                    prisma.announcement.create({
                        data: {
                            title,
                            message,
                            type,
                            status: initialStatus,
                            audience,
                            scope,

                            courseId: target.courseId,
                            classId: target.classId,
                            userId: target.userId,
                            mentorId: target.mentorId,

                            sendPush,
                            sendInApp,
                            imageUrl,
                            actionType,
                            actionTarget,
                            actionData,

                            scheduledAt: isScheduled ? new Date(scheduledAt) : null,
                            sentAt: !isScheduled ? new Date() : null
                        }
                    })

                )
            );

            // ----------------------------------
            // Send notifications
            // ----------------------------------

            if (!isScheduled) {
                for (const ann of createdAnnouncements) {
                    await AnnouncementController.sendAnnouncementNotifications(ann, tokens);
                }
            }

            if (isInternal) {
                return { success: true, data: createdAnnouncements };
            }

            return {
                status: 200,
                json: { success: true, data: createdAnnouncements }
            };

        } catch (error: any) {
            console.error("Error creating announcement:", error);

            if (isInternal) throw error;

            return {
                status: 500,
                json: { success: false, message: error.message }
            };
        }
    }

    static async sendAnnouncementNotifications(announcement: any, tokens: string[] = []) {
        try {

            const {
                id,
                title,
                message,
                audience,
                scope,
                courseId,
                classId,
                userId,
                mentorId,
                sendPush,
                sendInApp,
                imageUrl,
                actionType,
                actionTarget,
                actionData,
                type
            } = announcement;

            const targetTokensSet: Set<string> = new Set(tokens || []);

            if (targetTokensSet.size === 0 && (sendPush || sendInApp)) {

                const includeStudents = audience === "ALL_USERS" || audience === "STUDENTS";
                const includeTeachers = audience === "ALL_USERS" || audience === "TEACHERS";

                // ---------------- STUDENTS ----------------

                if (includeStudents) {

                    if (scope === "GLOBAL") {

                        const students = await prisma.endUsers.findMany({
                            where: { isActive: true },
                            select: { deviceId: true }
                        });

                        students.forEach(s => s.deviceId && targetTokensSet.add(s.deviceId));

                    }

                    else if (scope === "COURSE" && courseId) {

                        const subs = await prisma.mgSubsciption.findMany({
                            where: { bigCourseId: courseId, isActive: true },
                            select: { user: { select: { deviceId: true } } }
                        });

                        subs.forEach(s => s.user.deviceId && targetTokensSet.add(s.user.deviceId));

                    }

                    else if (scope === "CLASS" && classId) {

                        const students = await prisma.endUsers.findMany({
                            where: { grade: classId.toString(), isActive: true },
                            select: { deviceId: true }
                        });

                        students.forEach(s => s.deviceId && targetTokensSet.add(s.deviceId));

                    }

                    else if (scope === "INDIVIDUAL" && userId) {

                        const student = await prisma.endUsers.findUnique({
                            where: { id: userId },
                            select: { deviceId: true }
                        });

                        student?.deviceId && targetTokensSet.add(student.deviceId);

                    }

                }

                // ---------------- TEACHERS ----------------

                if (includeTeachers) {

                    if (scope === "GLOBAL") {

                        const mentors = await prisma.mentor.findMany({
                            where: { isActive: true },
                            select: { deviceId: true, mobileDeviceId: true }
                        });

                        mentors.forEach(m => {
                            m.deviceId && targetTokensSet.add(m.deviceId);
                            m.mobileDeviceId && targetTokensSet.add(m.mobileDeviceId);
                        });

                    }

                    else if (scope === "CLASS" && classId) {

                        const mentors = await prisma.mentor.findMany({
                            where: { Grades: { has: classId.toString() }, isActive: true },
                            select: { deviceId: true, mobileDeviceId: true }
                        });

                        mentors.forEach(m => {
                            m.deviceId && targetTokensSet.add(m.deviceId);
                            m.mobileDeviceId && targetTokensSet.add(m.mobileDeviceId);
                        });

                    }

                    else if (scope === "INDIVIDUAL" && mentorId) {

                        const mentor = await prisma.mentor.findUnique({
                            where: { id: Number(mentorId) },
                            select: { deviceId: true, mobileDeviceId: true }
                        });

                        if (mentor) {
                            mentor.deviceId && targetTokensSet.add(mentor.deviceId);
                            mentor.mobileDeviceId && targetTokensSet.add(mentor.mobileDeviceId);
                        }

                    }

                }

            }

            const finalTokens = Array.from(targetTokensSet).filter(Boolean);

            // ---------------- BATCH SEND ----------------

            if ((sendPush || sendInApp) && finalTokens.length) {

                const BATCH_SIZE = 300;
                const batches = chunkArray(finalTokens, BATCH_SIZE);

                for (let i = 0; i < batches.length; i++) {

                    const batch = batches[i];

                    try {

                        const response = await fetch("http://127.0.0.1:4004/", {
                            method: "POST",
                            body: JSON.stringify({
                                tokens: batch,
                                data: {
                                    id,
                                    title: title ?? "",
                                    body: message ?? "",
                                    imageUrl: imageUrl ?? "",
                                    category: "ANNOUNCEMENT",
                                    type,
                                    actionType: actionType ?? "NONE",
                                    actionTarget: actionTarget ?? "",
                                    actionData: actionData ? JSON.stringify(actionData) : ""
                                }
                            }),
                            headers: { "Content-Type": "application/json" }
                        }).then(res => res.text());

                        console.log(`Batch ${i + 1}/${batches.length} sent`, response);

                    } catch (err) {
                        console.error(`Batch ${i + 1} failed`, err);
                    }
                }
            }

            // ---------------- UPDATE STATS ----------------

            await prisma.announcement.update({
                where: { id },
                data: {
                    status: "SENT",
                    sentAt: new Date(),
                    totalSent: finalTokens.length
                }
            });

        } catch (error) {
            console.error("Error sending announcement notifications:", error);
            throw error;
        }
    }

    static async handleCreateAnnouncement(req: Request, res: Response) {
        const result = await AnnouncementController.createAnnouncement(req.body);
        return res.status(result.status).json(result.json);
    }

    // View all announcements (Admin)
    static async getAllAnnouncements(_req: Request, res: Response) {
        try {
            const announcements = await prisma.announcement.findMany({
                where: { isDeleted: false },
                orderBy: { createdAt: "desc" },
                include: {
                    _count: {
                        select: { reads: true }
                    }
                }
            });
            return res.json({ success: true, data: announcements });
        } catch (error: any) {
            console.error("Error fetching all announcements:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // View announcements for a student
    static async getStudentAnnouncements(req: Request, res: Response) {
        try {
            const { studentId, courseIds: providedCourseIds, grade: providedGrade } = req.body;

            let courseIds = providedCourseIds || [];
            let grade = providedGrade;

            if (studentId && (courseIds.length === 0 || !grade)) {
                const student = await prisma.endUsers.findUnique({
                    where: { id: studentId },
                    select: {
                        grade: true,
                        mgSubsciption: {
                            where: { isActive: true },
                            select: { bigCourseId: true }
                        }
                    }
                });

                if (student) {
                    if (!grade) grade = student.grade;
                    if (courseIds.length === 0) courseIds = student.mgSubsciption.map((s: any) => s.bigCourseId);
                }
            }

            const announcements = await prisma.announcement.findMany({
                where: {
                    isDeleted: false,
                    status: "SENT",
                    audience: { in: ["ALL_USERS", "STUDENTS"] } as any,
                    OR: [
                        { scope: "GLOBAL" },
                        { scope: "COURSE", courseId: { in: courseIds } },
                        { scope: "CLASS", classId: grade ? parseInt(grade) : undefined },
                        { scope: "INDIVIDUAL", userId: studentId }
                    ]
                },
                include: {
                    reads: {
                        where: { userId: studentId }
                    }
                },
                orderBy: { createdAt: "desc" }
            });

            const result = announcements.map((a: any) => ({
                ...a,
                isRead: a.reads.length > 0,
                reads: undefined // Remove internal relation data
            }));

            return res.json({ success: true, data: result });
        } catch (error: any) {
            console.error("Error fetching student announcements:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // View announcements for a teacher
    static async getTeacherAnnouncements(req: Request, res: Response) {
        try {
            const { teacherId, courseIds: providedCourseIds, grades: providedGrades } = req.body;

            let courseIds = providedCourseIds || [];
            let grades = providedGrades || [];

            if (teacherId && (courseIds.length === 0 || grades.length === 0)) {
                const mentor = await prisma.mentor.findUnique({
                    where: { id: teacherId },
                    select: { Grades: true }
                });

                if (mentor) {
                    if (grades.length === 0) grades = mentor.Grades;
                    if (courseIds.length === 0) {
                        const courses = await prisma.bigCourse.findMany({
                            where: { mentorList: { has: teacherId }, isActive: true },
                            select: { id: true }
                        });
                        courseIds = courses.map((c: any) => c.id);
                    }
                }
            }

            const announcements = await prisma.announcement.findMany({
                where: {
                    isDeleted: false,
                    status: "SENT",
                    audience: { in: ["ALL_USERS", "TEACHERS"] } as any,
                    OR: [
                        { scope: "GLOBAL" },
                        { scope: "COURSE", courseId: { in: courseIds } },
                        { scope: "CLASS", classId: { in: (grades || []).map((g: any) => parseInt(g)).filter((g: any) => !isNaN(g)) } },
                        { scope: "INDIVIDUAL", userId: teacherId },
                        { scope: "INDIVIDUAL", mentorId: teacherId }
                    ]
                },
                include: {
                    reads: {
                        where: { userId: teacherId }
                    }
                },
                orderBy: { createdAt: "desc" }
            });

            const result = announcements.map((a: any) => ({
                ...a,
                isRead: a.reads.length > 0,
                reads: undefined // Remove internal relation data
            }));

            return res.json({ success: true, data: result });
        } catch (error: any) {
            console.error("Error fetching teacher announcements:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // Mark announcement as read
    static async markAsRead(req: Request, res: Response) {
        try {
            const { announcementId, userId, mentorId } = req.body;

            if (!announcementId || (!userId && !mentorId)) {
                return res.status(400).json({ success: false, message: "Missing announcementId, userId or mentorId" });
            }

            // Check if already marked as read
            const whereClause = userId
                ? { announcementId_userId: { announcementId, userId } }
                : { announcementId_mentorId: { announcementId, mentorId } };

            const existing = await (prisma.announcementRead as any).findUnique({
                where: whereClause
            });

            if (!existing) {
                await (prisma.announcementRead as any).create({
                    data: {
                        announcementId,
                        userId: userId || undefined,
                        mentorId: mentorId || undefined
                    }
                });

                // Track metrics
                await prisma.announcement.update({
                    where: { id: announcementId },
                    data: { totalRead: { increment: 1 } }
                });
            }

            return res.json({ success: true });
        } catch (error: any) {
            console.error("Error marking announcement as read:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}