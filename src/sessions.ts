import { prisma } from './misc'
import { Request, Response } from 'express'
import { generateToken04 } from './zego'
import { randomUUID } from 'crypto'
import { createClassVM, deleteClassVM } from './vm_management/vm';
import { invalidateCache } from './utils/cacheUtils';
import { MaterialSource } from '@prisma/client'

const appId = 1500762473; // Your App ID
const serverSecret = "175fa0e5958efde603f2ec805c7d6120";
const effectiveTimeOut = 1 * 60 * 60 * 24
const MAIN_VM_WEBHOOK_TOKEN = process.env.MAIN_VM_WEBHOOK_TOKEN

export async function GetSessionsByBigCourse(req: Request, res: Response) {
    const { bigCourseId } = req.body
    try {
        const sessions = await prisma.session.findMany({ where: { bigCourseId } })
        res.json({ success: true, sessions })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

export async function InsertNewSession(req: Request, res: Response) {
    const { mentorId, startTime, endTime, bigCourseId, detail, subjectId, description } = req.body
    try {
        const nsession = await prisma.session.create({ data: { mentorId, startTime, endTime, bigCourseId, detail, subjectId, description } })
        await invalidateCache('bigCourses:upcomingSessions:*');
        await invalidateCache('bigCourses:completedSessions:*');
        await invalidateCache(`bigCourses:lessons:${bigCourseId}:*`);
        await invalidateCache(`bigCourses:todaySessions:${bigCourseId}:*`);

        res.json({ success: true, nsession })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })
    }
}

export async function EditSession(req: Request, res: Response) {
    const { id, mentorId, startTime, endTime, bigCourseId, detail, subjectId, isGoingOn, isDone, description, sessionStartTime,
        screenRecordingTimeStamp, } = req.body
    try {
        const nsession = await prisma.session.update({
            where: { id }, data: {
                mentorId, startTime, endTime, bigCourseId, detail, subjectId, isGoingOn, isDone, description, sessionStartTime: sessionStartTime ? new Date(sessionStartTime) : undefined,
                screenRecordingTimeStamp,
            }
        })
        await invalidateCache('bigCourses:upcomingSessions:*');
        await invalidateCache('bigCourses:completedSessions:*');
        await invalidateCache(`bigCourses:todaySessions:*`);
        if (bigCourseId) {
            await invalidateCache(`bigCourses:lessons:${bigCourseId}:*`);
        }
        res.json({ success: true, nsession })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })
    }
}
export async function GetSessionsWithMaterialsByBigCourse(req: Request, res: Response) {
    const { bigCourseId } = req.body
    try {
        const [sessions, legacyCourseMaterials] = await Promise.all([
            prisma.session.findMany({
                where: { bigCourseId },
                select: {
                    id: true,
                    detail: true,
                    startTime: true,
                    endTime: true,
                    isDone: true,
                    isGoingOn: true,
                    subject: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    courseMaterials: true
                },
                orderBy: {
                    startTime: 'desc'
                }
            }),
            prisma.courseMaterial.findMany({
                where: {
                    bigCourseId,
                    source: MaterialSource.LEGACY
                }
            })
        ])

        res.json({ success: true, sessions, legacyCourseMaterials })
    } catch (error) {
        console.error('Error in GetSessionsWithMaterialsByBigCourse:', error);
        res.status(500).json({ success: false, error })
    }
}

// export async function EditSession2(req: Request, res: Response) {
//     const { id, mentorId, startTime, endTime, bigCourseId, detail, subjectId, isGoingOn, isDone, description, sessionStartTime,
//         screenRecordingTimeStamp, } = req.body
//     try {
//         const nsession = await prisma.session.update({
//             where: { id }, data: {
//                 mentorId, startTime, endTime, bigCourseId, detail, subjectId, isGoingOn, isDone, description, sessionStartTime: sessionStartTime ? new Date(sessionStartTime) : undefined,
//                 screenRecordingTimeStamp,
//             }
//         })
//         await deleteClassVM(id);
//         res.json({ success: true, nsession })
//     } catch (error) {
//         console.log(error)
//         res.json({ success: false, error })
//     }
// }

export async function EditSession2(req: Request, res: Response) {
    const {
        id, mentorId, startTime, endTime, bigCourseId, detail,
        subjectId, isGoingOn, isDone, description, sessionStartTime,
        screenRecordingTimeStamp,
        hostRecordingUrl,
        screenRecordingUrl
    } = req.body;

    try {
        // Update session
        const nsession = await prisma.session.update({
            where: { id },
            data: {
                mentorId,
                startTime,
                endTime,
                bigCourseId,
                detail,
                subjectId,
                isGoingOn,
                isDone,
                description,
                sessionStartTime: sessionStartTime ? new Date(sessionStartTime) : undefined,
                screenRecordingTimeStamp,
                hostRecordingUrl,
                screenRecordingUrl
            }
        });

        // Trigger VM delete async
        deleteClassVM(id).catch((err) => {
            console.error(`VM delete failed for session ${id}:`, err);
        });

        await invalidateCache('bigCourses:upcomingSessions:*');
        await invalidateCache('bigCourses:completedSessions:*');
        await invalidateCache(`bigCourses:todaySessions:*`);
        if (bigCourseId) {
            await invalidateCache(`bigCourses:lessons:${bigCourseId}:*`);
            await invalidateCache(`bigCourses:todaySessions:*`);
        }
        res.json({ success: true, nsession });

    } catch (error) {
        console.error(error);
        res.json({ success: false, error });
    }
}



export async function GetVMIP(req: Request, res: Response) {
    const { id } = req.body;

    try {
        const session = await prisma.session.findUnique({
            where: { id },
            select: { vmIp: true }
        });

        if (!session) {
            return res.status(404).json({ success: false, message: "Session not found" });
        }

        return res.json({ success: true, vmIp: session.vmIp });
    } catch (error) {
        console.error(error);
        res.json({ success: false, error });
    }
}


export async function InsertNewSessionStream(req: Request, res: Response) {
    const { sessionId, mentorId } = req.body

    try {
        const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { bigCourseId: true } });
        const Token = generateToken04(appId, mentorId, serverSecret, effectiveTimeOut)
        const roomId = randomUUID()
        const nsession = await prisma.sessionStreamInfo.create({ data: { sessionId, Token, roomId, vmIp: 'sisyaclass.xyz' } })
        const updatedSession = await prisma.session.update({ where: { id: sessionId }, data: { isGoingOn: true, roomId, tokenId: Token, vmIp: 'sisyaclass.xyz' } })
        await invalidateCache('bigCourses:upcomingSessions:*');
        await invalidateCache('bigCourses:completedSessions:*');
        if (session?.bigCourseId) {
            await invalidateCache(`bigCourses:lessons:${session.bigCourseId}:*`);
            await invalidateCache(`bigCourses:todaySessions:${session.bigCourseId}:*`);
        }
        res.json({ success: true, streamInfo: { ...nsession, Token, updatedSession } })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })
    }
}

export async function InsertNewSessionStream2(req: Request, res: Response) {
    const { sessionId, mentorId } = req.body
    console.log("sessuib id is ", sessionId);
    let response;

    try {
        const randomNumber = Math.floor(100000 + Math.random() * 900000).toString();

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { vmIp: true, bigCourseId: true }
        });
        if (!session.vmIp) {
            console.log("no vm ip, creating vm");
            response = await createClassVM(sessionId);
            const socket_url = response.domain;
            console.log("vm created, url is ", socket_url);
            const Token = generateToken04(appId, mentorId, serverSecret, effectiveTimeOut)
            const roomId = randomUUID()
            const nsession = await prisma.sessionStreamInfo.create({ data: { sessionId, Token, roomId, vmIp: socket_url } })
            const updatedSession = await prisma.session.update({ where: { id: sessionId }, data: { isGoingOn: true, roomId, tokenId: Token, vmIp: socket_url } })
            await invalidateCache('bigCourses:upcomingSessions:*');
            await invalidateCache('bigCourses:completedSessions:*');
            if (session?.bigCourseId) {
                await invalidateCache(`bigCourses:lessons:${session.bigCourseId}:*`);
                await invalidateCache(`bigCourses:todaySessions:${session.bigCourseId}:*`);
            }
            res.json({ success: true, streamInfo: { ...nsession, Token, updatedSession } })
        } else {

            const Token = generateToken04(appId, mentorId, serverSecret, effectiveTimeOut)
            const roomId = randomUUID()
            const nsession = await prisma.sessionStreamInfo.create({ data: { sessionId, Token, roomId, vmIp: session.vmIp } })
            const updatedSession = await prisma.session.update({ where: { id: sessionId }, data: { isGoingOn: true, roomId, tokenId: Token, vmIp: session.vmIp } })
            console.log("vm exists, url is ", session.vmIp);
            await invalidateCache('bigCourses:upcomingSessions:*');
            await invalidateCache('bigCourses:completedSessions:*');
            if (session?.bigCourseId) {
                await invalidateCache(`bigCourses:lessons:${session.bigCourseId}:*`);
                await invalidateCache(`bigCourses:todaySessions:${session.bigCourseId}:*`);
            }
            res.json({ success: true, streamInfo: { ...nsession, Token, updatedSession } })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })
    }
}

export async function recordingUploadedWebhook(req: Request, res: Response) {
    try {
        const authHeader = req.headers["authorization"];
        const token = authHeader?.toString().replace("Bearer ", "");

        if (!token || token !== process.env.MAIN_VM_WEBHOOK_TOKEN) {
            return res.status(403).json({ success: false, error: "Unauthorized webhook" });
        }

        const { sessionId, url } = req.body;

        if (!sessionId || !url) {
            return res.status(400).json({
                success: false,
                error: "sessionId and url are required"
            });
        }

        console.log("Webhook received:", { sessionId, url });

        await prisma.session.update({
            where: { id: +sessionId },
            data: {
                recordingUrl: url,
                isNewRecording: true
            },
        });

        console.log("Recording URL saved:", sessionId);
        const session = await prisma.session.findUnique({ where: { id: +sessionId }, select: { bigCourseId: true } });
        await invalidateCache('bigCourses:upcomingSessions:*');
        await invalidateCache('bigCourses:completedSessions:*');
        await invalidateCache('bigCourses:recordings:*');
        await invalidateCache('bigCourses:recordings:search:*');
        if (session?.bigCourseId) {
            await invalidateCache(`bigCourses:lessons:${session.bigCourseId}:*`);
            await invalidateCache(`bigCourses:todaySessions:${session.bigCourseId}:*`);
        }

        return res.json({ success: true });
    } catch (error: any) {
        console.error("Webhook error:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function getStreamInfo(req: Request, res: Response) {
    const { sessionId } = req.body

    try {
        const streamInfo = await prisma.sessionStreamInfo.findFirst({ where: { sessionId } })
        res.json({ success: true, streamInfo })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })
    }
}

// export const deleteSession = async (req: Request, res: Response) => {
//     const { sessionId } = req.body; // using body instead of params

//     try {
//         const id = parseInt(sessionId, 10);
//         if (isNaN(id)) {
//             return res.status(400).json({ message: "Invalid session ID" });
//         }

//         await prisma.$transaction(async (tx) => {
//             // 1. Delete session analytics and related records
//             const analytics = await tx.sessionAnalytics.findUnique({
//                 where: { sessionId: id },
//             });

//             if (analytics) {
//                 await tx.studentAttendanceInterval.deleteMany({
//                     where: { analyticsId: analytics.id },
//                 });

//                 await tx.teacherSessionAnalytics.deleteMany({
//                     where: { analyticsId: analytics.id },
//                 });

//                 await tx.sessionAnalytics.delete({
//                     where: { id: analytics.id },
//                 });
//             }

//             // 2. Delete session tests and related data
//             const sessionTests = await tx.sessionTest.findMany({
//                 where: { sessionId: id },
//             });

//             for (const test of sessionTests) {
//                 await tx.sessionTestResponse.deleteMany({
//                     where: { sessionTestId: test.id },
//                 });

//                 await tx.sessionTestSubmission.deleteMany({
//                     where: { sessionTestId: test.id },
//                 });

//                 await tx.sessionTestQuestion.deleteMany({
//                     where: { sessionTestId: test.id },
//                 });

//                 await tx.sessionTest.delete({
//                     where: { id: test.id },
//                 });
//             }

//             // 3. Delete quiz and related data
//             const quiz = await tx.quiz.findUnique({
//                 where: { sessionId: id },
//             });

//             if (quiz) {
//                 await tx.response.deleteMany({
//                     where: { question: { quizId: quiz.id } },
//                 });

//                 await tx.question.deleteMany({
//                     where: { quizId: quiz.id },
//                 });

//                 await tx.quiz.delete({
//                     where: { id: quiz.id },
//                 });
//             }

//             // 4. Delete other related records
//             await tx.attendanceRecord.deleteMany({
//                 where: { sessionId: id },
//             });

//             await tx.sessionFeedback.deleteMany({
//                 where: { sessionId: id },
//             });

//             await tx.sessionStreamInfo.deleteMany({
//                 where: { sessionId: id },
//             });

//             // 5. Disconnect qTests from session (keep qTests intact)
//             await tx.qtest.updateMany({
//                 where: { sessionId: id },
//                 data: { sessionId: null },
//             });

//             // 6. Finally delete the session
//             await tx.session.delete({
//                 where: { id },
//             });
//         });

//         return res.status(200).json({ message: "Session deleted successfully" });
//     } catch (error: any) {
//         console.error("Error deleting session:", error);
//         return res.status(500).json({
//             message: "Internal server error",
//             error: error.message,
//         });
//     }
// };


export const deleteSession = async (req: Request, res: Response) => {
    const { sessionId } = req.body;

    try {
        const id = parseInt(sessionId, 10);
        if (isNaN(id)) {
            return res.status(400).json({ message: "Invalid session ID" });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Delete session analytics and related records
            const analytics = await tx.sessionAnalytics.findUnique({
                where: { sessionId: id },
            });

            if (analytics) {
                await tx.studentAttendanceInterval.deleteMany({
                    where: { analyticsId: analytics.id },
                });

                await tx.teacherSessionAnalytics.deleteMany({
                    where: { analyticsId: analytics.id },
                });

                await tx.sessionAnalytics.delete({
                    where: { id: analytics.id },
                });
            }

            // 2. Delete session tests and related data
            const sessionTests = await tx.sessionTest.findMany({
                where: { sessionId: id },
            });

            for (const test of sessionTests) {
                await tx.sessionTestResponse.deleteMany({
                    where: { sessionTestId: test.id },
                });

                await tx.sessionTestSubmission.deleteMany({
                    where: { sessionTestId: test.id },
                });

                await tx.sessionTestQuestion.deleteMany({
                    where: { sessionTestId: test.id },
                });

                await tx.sessionTest.delete({
                    where: { id: test.id },
                });
            }

            // 3. Delete quiz and related data
            const quiz = await tx.quiz.findUnique({
                where: { sessionId: id },
            });

            if (quiz) {
                await tx.response.deleteMany({
                    where: { question: { quizId: quiz.id } },
                });

                await tx.question.deleteMany({
                    where: { quizId: quiz.id },
                });

                await tx.quiz.delete({
                    where: { id: quiz.id },
                });
            }

            // 4. Delete PreSessionReminder records
            await tx.preSessionReminder.deleteMany({
                where: { sessionId: id },
            });

            // 5. Delete SessionReminder records
            await tx.sessionReminder.deleteMany({
                where: { sessionId: id },
            });

            // 6. Delete SessionFeedback records
            await tx.sessionFeedback.deleteMany({
                where: { sessionId: id },
            });

            // 7. Delete attendance records
            await tx.attendanceRecord.deleteMany({
                where: { sessionId: id },
            });

            // 8. Delete session stream info
            await tx.sessionStreamInfo.deleteMany({
                where: { sessionId: id },
            });

            // 9. Handle qTests - disconnect from session (set sessionId to null)
            await tx.qtest.updateMany({
                where: { sessionId: id },
                data: { sessionId: null },
            });

            // 10. Finally delete the session
            await tx.session.delete({
                where: { id },
            });
        });

        const session = await prisma.session.findUnique({ where: { id }, select: { bigCourseId: true } }).catch(() => null);
        await invalidateCache('bigCourses:upcomingSessions:*');
        await invalidateCache('bigCourses:completedSessions:*');
        if (session?.bigCourseId) {
            await invalidateCache(`bigCourses:lessons:${session.bigCourseId}:*`);
            await invalidateCache(`bigCourses:todaySessions:${session.bigCourseId}:*`);
        }
        return res.status(200).json({ message: "Session deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting session:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message,
        });
    }
};