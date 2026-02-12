import { Request, Response } from "express";

import { Decimal } from "@prisma/client/runtime/library";
import { prisma, redis } from "./misc";

export async function GetStudentsByCourse(req: Request, res: Response) {
    const { bigCourseId } = req.body;

    if (!bigCourseId) {
        return res.status(400).json({ success: false, message: "bigCourseId is required" });
    }

    try {
        const students = await prisma.mgSubsciption.findMany({
            where: {
                bigCourseId: Number(bigCourseId), isActive: true,
                user: {
                    isActive: true,
                    isSisyaEmp: false,
                },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        uuid: true,
                        name: true,
                        email: true,
                        phone: true,
                        grade: true,
                    },
                },
                course: {
                    select: {
                        grade: true
                    }
                }
            },
        });

        res.status(200).json({
            success: true,
            students: students.map((s) => ({
                ...s.user,
                grade: s.course.grade,
                joinedAt: s.createdAt
            })),
        });
    } catch (error: any) {
        console.error("Error fetching students by course:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetCoursePerformanceSummary(req: Request, res: Response) {
    const { bigCourseId } = req.body;

    if (!bigCourseId) {
        return res.status(400).json({ success: false, message: "bigCourseId is required" });
    }

    try {
        const courseId = Number(bigCourseId);

        const [
            totalEnrolled,
            sessionsDone,
            totalDuration,
            sessionFeedbacks,
            homeworkCount,
            ctestCount,
            course
        ] = await Promise.all([
            prisma.mgSubsciption.count({
                where: {
                    bigCourseId: courseId, isActive: true,
                    user: {
                        isActive: true,
                        isSisyaEmp: false,
                    }
                }
            }),
            prisma.session.count({ where: { bigCourseId: courseId, isDone: true } }),
            prisma.sessionAnalytics.aggregate({
                _sum: { actualDuration: true },
                where: { session: { bigCourseId: courseId, isDone: true } }
            }),
            prisma.sessionFeedback.findMany({
                where: { session: { bigCourseId: courseId } },
                select: { rating: true }
            }),
            prisma.sessionTest.count({
                where: { createdFor: { bigCourseId: courseId } }
            }),
            prisma.ctest.count({
                where: { bigCourseId: courseId }
            }),
            prisma.bigCourse.findUnique({
                where: { id: courseId },
                select: { subjectList: true, averageRating: true }
            })
        ]);

        const avgSessionRating = sessionFeedbacks.length > 0
            ? sessionFeedbacks.reduce((acc, f) => acc + f.rating, 0) / sessionFeedbacks.length
            : 0;

        res.status(200).json({
            success: true,
            summary: {
                enrolledStudents: totalEnrolled,
                sessions: {
                    totalDone: sessionsDone,
                    totalDurationMinutes: totalDuration._sum.actualDuration || 0,
                    avgRating: parseFloat(avgSessionRating.toFixed(2))
                },
                homework: {
                    totalAssigned: homeworkCount
                },
                tests: {
                    totalAssigned: ctestCount
                },
                courseRating: course?.averageRating || 0
            }
        });
    } catch (error: any) {
        console.error("Error fetching course performance summary:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetCourseSessionDetails(req: Request, res: Response) {
    const { bigCourseId, mentorId, search, startDate, endDate, page = 1, limit = 20 } = req.body;

    if (!bigCourseId) {
        return res.status(400).json({ success: false, message: "bigCourseId is required" });
    }

    try {
        const courseId = Number(bigCourseId);
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        let where: any = { bigCourseId: courseId, isDone: true };

        if (mentorId) {
            where.mentorId = Number(mentorId);
        }

        if (search) {
            where.detail = { contains: search, mode: 'insensitive' };
        }

        if (startDate || endDate) {
            const dateFilter: any = {};
            if (startDate) dateFilter.gte = new Date(startDate);
            if (endDate) dateFilter.lte = new Date(endDate);
            where.startTime = dateFilter;
        }

        const [total, sessions] = await Promise.all([
            prisma.session.count({ where }),
            prisma.session.findMany({
                where,
                orderBy: { startTime: "desc" },
                skip,
                take,
                include: {
                    mentor: { select: { id: true, name: true } },
                    subject: { select: { name: true } },
                    SessionTest: { select: { id: true }, take: 1 },
                    analytics: {
                        include: {
                            teacherAttendance: {
                                include: {
                                    teacher: { select: { id: true, name: true } }
                                }
                            },
                            studentIntervals: {
                                select: {
                                    studentId: true,
                                    student: { select: { isSisyaEmp: true } }
                                }
                            }
                        }
                    },
                    feedbacks: { select: { rating: true } }
                }
            })
        ]);

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            limit: Number(limit),
            sessions: sessions.map(s => {
                const uniqueStudents = new Set(
                    s.analytics?.studentIntervals
                        .filter(i => !i.student.isSisyaEmp)
                        .map(i => i.studentId) || []
                );
                const avgRating = s.feedbacks.length > 0
                    ? s.feedbacks.reduce((acc, f) => acc + f.rating, 0) / s.feedbacks.length
                    : 0;

                return {
                    id: s.id,
                    title: s.detail,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    allocatedTeacher: {
                        id: s.mentor.id,
                        name: s.mentor.name
                    },
                    actualTeacher: s.analytics?.teacherAttendance ? {
                        id: s.analytics.teacherAttendance.teacher.id,
                        name: s.analytics.teacherAttendance.teacher.name
                    } : null,
                    subjectName: s.subject.name,
                    isDone: s.isDone,
                    isGoingOn: s.isGoingOn,
                    hasHomework: s.SessionTest.length > 0,
                    analytics: {
                        totalStudentsJoined: uniqueStudents.size,
                        avgRating: parseFloat(avgRating.toFixed(2)),
                        reviewCount: s.feedbacks.length,
                        actualStartTime: s.analytics?.classStartTime || null,
                        actualEndTime: s.analytics?.classEndTime || null,
                        actualDuration: s.analytics?.actualDuration || 0
                    }
                };
            })
        });
    } catch (error: any) {
        console.error("Error fetching course session details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetCourseHomeworkDetails(req: Request, res: Response) {
    const { bigCourseId } = req.body;

    if (!bigCourseId) {
        return res.status(400).json({ success: false, message: "bigCourseId is required" });
    }

    try {
        const courseId = Number(bigCourseId);

        const sessionTests = await prisma.sessionTest.findMany({
            where: { createdFor: { bigCourseId: courseId } },
            orderBy: {
                createdOn: "desc"
            },
            include: {
                createdFor: {
                    select: { detail: true, startTime: true }
                },
                _count: {
                    select: { sessionTestSubmission: true, sessionTestQuestion: true }
                }
            }
        });

        res.status(200).json({
            success: true,
            homeworkDetails: sessionTests.map(hw => ({
                homeworkId: hw.id,
                sessionId: hw.sessionId,
                sessionName: hw.createdFor?.detail || "",
                sessionDate: hw.createdFor?.startTime || null,
                totalQuestions: hw._count.sessionTestQuestion,
                submissionCount: hw._count.sessionTestSubmission,
                createdAt: hw.createdOn
            }))
        });
    } catch (error: any) {
        console.error("Error fetching course homework details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetCourseReviewDetails(req: Request, res: Response) {
    const { bigCourseId } = req.body;

    if (!bigCourseId) {
        return res.status(400).json({ success: false, message: "bigCourseId is required" });
    }

    try {
        const courseId = Number(bigCourseId);

        const reviews = await prisma.sessionFeedback.findMany({
            where: { session: { bigCourseId: courseId } },
            include: {
                session: { select: { detail: true, startTime: true } },
                student: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.status(200).json({
            success: true,
            reviewDetails: reviews.map(r => ({
                id: r.id,
                rating: r.rating,
                comment: r.general,
                studentName: r.student.name,
                sessionTitle: r.session.detail,
                sessionDate: r.session.startTime,
                techIssue: r.techIssue,
                sessionIssue: r.sessionIssue,
                createdAt: r.createdAt
            }))
        });
    } catch (error: any) {
        console.error("Error fetching course review details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetCourseTestDetails(req: Request, res: Response) {
    const { bigCourseId } = req.body;

    if (!bigCourseId) {
        return res.status(400).json({ success: false, message: "bigCourseId is required" });
    }

    try {
        const courseId = Number(bigCourseId);

        const tests = await prisma.ctest.findMany({
            where: { bigCourseId: courseId },
            orderBy: {
                startDate: "desc"
            },
            include: {
                _count: {
                    select: { ctestSubmission: true, ctestQuestions: true, imageQuestions: true }
                }
            }
        });

        res.status(200).json({
            success: true,
            testDetails: tests.map(test => ({
                testId: test.id,
                title: test.title,
                mode: test.mode,
                startDate: test.startDate,
                endDate: test.endDate,
                duration: test.Duration,
                totalMarks: test.totalMarks,
                questionCount: test._count.ctestQuestions + test._count.imageQuestions,
                submissionCount: test._count.ctestSubmission,
                createdAt: test.createdOn
            }))
        });
    } catch (error: any) {
        console.error("Error fetching course test details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

// Helper to calculate rates and counts
const calculateAttendanceRates = (sessionMetrics: any[], totalSessions: number) => {
    if (totalSessions === 0) return { lateJoinRate: 0, earlyLeaveRate: 0, finishRate: 0, attendanceRate: 0, presentCount: 0, totalSessions: 0 };

    const presentCount = sessionMetrics.length;
    const lateJoins = sessionMetrics.filter(m => m.isLateJoin).length;
    const earlyLeaves = sessionMetrics.filter(m => m.isEarlyLeave).length;
    const finishes = sessionMetrics.filter(m => (m.duration || 0) > 0.9 * (m.sessionDuration || 0)).length;

    return {
        lateJoinRate: parseFloat((lateJoins / totalSessions).toFixed(3)),
        earlyLeaveRate: parseFloat((earlyLeaves / totalSessions).toFixed(3)),
        finishRate: parseFloat((finishes / totalSessions).toFixed(3)),
        attendanceRate: parseFloat((presentCount / totalSessions).toFixed(3)),
        presentCount,
        totalSessions
    };
};

export async function GetStudentPerformanceSummary(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body;

    if (!endUsersId || !bigCourseId) {
        return res.status(400).json({ success: false, message: "endUsersId and bigCourseId are required" });
    }

    try {
        const userId = Number(endUsersId);
        const courseId = Number(bigCourseId);

        // --- Start Caching Logic ---
        const cacheKey = `course_analytics_avg:${courseId}`;
        const cachedData = await redis.get(cacheKey);

        let courseMetrics: any;

        if (cachedData) {
            courseMetrics = JSON.parse(cachedData);
        } else {
            // Fetch course-wide data
            const [
                totalSessions,
                totalQuizzes,
                totalTests,
                totalHomeworkCount,
                allSubscribedStudents,
                classQuizAvg,
                classTestSubmissions,
                classHwSubmissions,
                classSessionsAttended
            ] = await Promise.all([
                prisma.session.count({ where: { bigCourseId: courseId, isDone: true } }),
                prisma.sisyaClassQuiz.count({ where: { session: { bigCourseId: courseId } } }),
                prisma.ctest.count({ where: { bigCourseId: courseId } }),
                prisma.sessionTest.count({ where: { createdFor: { bigCourseId: courseId } } }),
                prisma.mgSubsciption.findMany({
                    where: { bigCourseId: courseId, isActive: true },
                    select: { user: { select: { id: true } } }
                }),
                prisma.sisyaClassQuizResponse.aggregate({
                    where: { quiz: { session: { bigCourseId: courseId } } },
                    _count: { _all: true }
                }),
                prisma.ctestSubmission.count({
                    where: { ctest: { bigCourseId: courseId } }
                }),
                prisma.sessionTestSubmission.count({
                    where: { test: { createdFor: { bigCourseId: courseId } } }
                }),
                prisma.studentAttendanceInterval.groupBy({
                    by: ['studentId', 'analyticsId'],
                    where: { sessionAnalytics: { session: { bigCourseId: courseId } } }
                })
            ]);

            const totalEnrolled = allSubscribedStudents.length;

            // Calculate Class Avg Attendance
            const sessionsPerStudent = new Map<number, number>();
            classSessionsAttended.forEach(a => sessionsPerStudent.set(a.studentId, (sessionsPerStudent.get(a.studentId) || 0) + 1));
            const avgSessionsAttended = Array.from(sessionsPerStudent.values()).reduce((a, b) => a + b, 0) / (totalEnrolled || 1);
            const classAvgAttendanceRate = totalSessions > 0 ? avgSessionsAttended / totalSessions : 0;

            // Calculate Class Avg Quiz Participation
            const totalQuizResponsesClass = classQuizAvg._count._all;
            const classAvgQuizParticipation = (totalQuizzes > 0 && totalEnrolled > 0) ? totalQuizResponsesClass / (totalQuizzes * totalEnrolled) : 0;

            // Calculate Class Avg Test Completion
            const classAvgTestCompletion = (totalTests > 0 && totalEnrolled > 0) ? classTestSubmissions / (totalTests * totalEnrolled) : 0;

            // Calculate Class Avg Homework Attempt Rate
            const classAvgHwAttemptRate = (totalHomeworkCount > 0 && totalEnrolled > 0) ? classHwSubmissions / (totalHomeworkCount * totalEnrolled) : 0;

            courseMetrics = {
                totalSessions,
                totalQuizzes,
                totalTests,
                totalHomeworkCount,
                totalEnrolled,
                classAvgAttendanceRate,
                classAvgQuizParticipation,
                classAvgTestCompletion,
                classAvgHwAttemptRate
            };

            // Cache for 5 minutes
            await redis.set(cacheKey, JSON.stringify(courseMetrics), "EX", 300);
        }
        // --- End Caching Logic ---
        // Fetch Student-Specific data in parallel
        const [studentAttendanceIntervals, studentQuizResponses, studentTestSubmissions] = await Promise.all([
            prisma.studentAttendanceInterval.findMany({
                where: { studentId: userId, sessionAnalytics: { session: { bigCourseId: courseId } } },
                include: { sessionAnalytics: true }
            }),
            prisma.sisyaClassQuizResponse.findMany({
                where: { userId: userId, quiz: { session: { bigCourseId: courseId } } }
            }),
            prisma.ctestSubmission.findMany({
                where: { endUsersId: userId, ctest: { bigCourseId: courseId } }
            })
        ]);

        // 1. Attendance Logic (Enhanced with grouping)
        const sessionMap = new Map<number, any>();
        studentAttendanceIntervals.forEach(i => {
            const sid = i.sessionAnalytics.sessionId!;
            if (!sessionMap.has(sid)) sessionMap.set(sid, { duration: 0, isLateJoin: false, isEarlyLeave: false });
            const s = sessionMap.get(sid);
            s.duration += (i.duration || 0);
            if (i.isLateJoin) s.isLateJoin = true;
            if (i.isEarlyLeave) s.isEarlyLeave = true;
        });
        const attendanceStats = calculateAttendanceRates(Array.from(sessionMap.values()), courseMetrics.totalSessions);

        // 2. Quizzes Logic
        const quizzesAttempted = studentQuizResponses.length;
        const correctAnswers = studentQuizResponses.filter(r => r.isCorrect).length;
        const quizAccuracy = quizzesAttempted > 0 ? correctAnswers / quizzesAttempted : 0;

        // 3. Tests Logic
        const testsAttempted = studentTestSubmissions.length;
        const testCompletionRate = courseMetrics.totalTests > 0 ? testsAttempted / courseMetrics.totalTests : 0;

        // 4. Homework Logic
        const sessionTests = await prisma.sessionTest.findMany({
            where: { createdFor: { bigCourseId: courseId } },
            include: {
                _count: { select: { sessionTestQuestion: true } },
                sessionTestSubmission: { where: { endUsersId: userId } }
            }
        });

        let homeworkAttempted = 0;
        let totalHomeworkQuestions = 0;
        let totalHomeworkCorrect = 0;

        for (const hw of sessionTests) {
            totalHomeworkQuestions += (hw as any)._count?.sessionTestQuestion || 0;
            if ((hw as any).sessionTestSubmission?.length > 0) {
                homeworkAttempted++;
                const questions = await prisma.sessionTestQuestion.findMany({
                    where: { sessionTestId: hw.id },
                    select: { id: true, correctResponse: true }
                });
                const correctMap = new Map(questions.map(q => [q.id, q.correctResponse]));
                const responses = await prisma.sessionTestResponse.findMany({
                    where: { endUsersId: userId, sessionTestId: hw.id }
                });
                totalHomeworkCorrect += responses.filter(r => r.response === correctMap.get(r.sessionTestQuestionId)).length;
            }
        }

        const homeworkAttemptRate = courseMetrics.totalHomeworkCount > 0 ? homeworkAttempted / courseMetrics.totalHomeworkCount : 0;

        // 5. Doubts & Satisfaction
        const [totalDoubts, solvedDoubts, feedbacks] = await Promise.all([
            prisma.doubt.count({ where: { userId: userId } }),
            prisma.doubt.count({ where: { userId: userId, status: 2 } }),
            prisma.sessionFeedback.findMany({
                where: { studentId: userId, session: { bigCourseId: courseId } },
                select: { rating: true }
            })
        ]);
        const avgSatisfaction = feedbacks.length > 0 ? feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length : 0;

        // 6. Coins Logic
        const wallet = await prisma.sisyaWallet.findUnique({
            where: {
                ownerType_ownerId: {
                    ownerType: 'ENDUSER',
                    ownerId: userId
                }
            }
        });

        const coinsStats = {
            balance: wallet ? Number(wallet.spendableBalance) : 0,
            totalEarned: wallet ? Number(wallet.totalEarned) : 0,
            totalSpent: wallet ? Number(wallet.totalSpent) : 0
        };

        // 7. Reviews Logic
        const [doubtReviews, mentorReviews, aiRatings] = await Promise.all([
            prisma.doubtReview.findMany({
                where: { userId: userId },
                select: { rating: true }
            }),
            prisma.mentorRatings.findMany({
                where: { userId: userId },
                select: { rating: true }
            }),
            prisma.aIRating.findMany({
                where: { userId: userId },
                select: { rating: true }
            })
        ]);

        const reviewsStats = {
            totalSessionFeedbacks: feedbacks.length,
            totalDoubtReviews: doubtReviews.length,
            totalMentorReviews: mentorReviews.length,
            totalAIRatings: aiRatings.length
        };


        res.status(200).json({
            success: true,
            summary: {
                coins: coinsStats,
                attendance: { ...attendanceStats, classAvgRate: parseFloat(courseMetrics.classAvgAttendanceRate.toFixed(3)) },
                quizzes: {
                    total: courseMetrics.totalQuizzes,
                    attempted: quizzesAttempted,
                    correct: correctAnswers,
                    participationRate: parseFloat((quizzesAttempted / (courseMetrics.totalQuizzes || 1)).toFixed(3)),
                    accuracy: parseFloat(quizAccuracy.toFixed(3)),
                    classAvgParticipation: parseFloat(courseMetrics.classAvgQuizParticipation.toFixed(3))
                },
                tests: {
                    total: courseMetrics.totalTests,
                    attempted: testsAttempted,
                    completionRate: parseFloat(testCompletionRate.toFixed(3)),
                    classAvgCompletion: parseFloat(courseMetrics.classAvgTestCompletion.toFixed(3))
                },
                homework: {
                    total: courseMetrics.totalHomeworkCount,
                    attempted: homeworkAttempted,
                    totalQuestions: totalHomeworkQuestions,
                    totalCorrect: totalHomeworkCorrect,
                    attemptRate: parseFloat(homeworkAttemptRate.toFixed(3)),
                    classAvgAttemptRate: parseFloat(courseMetrics.classAvgHwAttemptRate.toFixed(3))
                },
                doubts: { total: totalDoubts, solved: solvedDoubts },
                satisfaction: {
                    averageRating: parseFloat(avgSatisfaction.toFixed(2)),
                    feedbackCount: feedbacks.length
                },
                reviews: reviewsStats
            }
        });
    } catch (error: any) {
        console.error("Error fetching student performance summary:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetStudentAttendanceDetails(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body;

    if (!endUsersId || !bigCourseId) {
        return res.status(400).json({ success: false, message: "endUsersId and bigCourseId are required" });
    }

    try {
        const userId = Number(endUsersId);
        const courseId = Number(bigCourseId);

        const sessions = await prisma.session.findMany({
            where: { bigCourseId: courseId, isDone: true },
            include: {
                analytics: {
                    include: {
                        studentIntervals: {
                            where: { studentId: userId }
                        }
                    }
                }
            },
            orderBy: { startTime: 'desc' }
        });

        const details = sessions.map(session => {
            const intervals = session.analytics?.studentIntervals || [];
            const isPresent = intervals.length > 0;
            const duration = intervals.reduce((acc, i) => acc + (i.duration || 0), 0);
            const isLateJoin = intervals.some(i => i.isLateJoin);
            const isEarlyLeave = intervals.some(i => i.isEarlyLeave);

            // Get first join and last leave if multiple intervals exist
            let joinTime = null;
            let leaveTime = null;
            if (isPresent) {
                const sorted = [...intervals].sort((a, b) => a.joinTime.getTime() - b.joinTime.getTime());
                joinTime = sorted[0].joinTime;
                const sortedByLeave = [...intervals].sort((a, b) => (b.leaveTime?.getTime() || 0) - (a.leaveTime?.getTime() || 0));
                leaveTime = sortedByLeave[0].leaveTime;
            }

            return {
                sessionId: session.id,
                title: session.detail,
                startTime: session.startTime,
                endTime: session.endTime,
                isPresent,
                joinTime,
                leaveTime,
                isLateJoin,
                isEarlyLeave,
                effectiveDuration: duration
            };
        });

        res.status(200).json({ success: true, attendanceDetails: details });
    } catch (error: any) {
        console.error("Error fetching attendance details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetStudentQuizDetails(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body;

    if (!endUsersId || !bigCourseId) {
        return res.status(400).json({ success: false, message: "endUsersId and bigCourseId are required" });
    }

    try {
        const userId = Number(endUsersId);
        const courseId = Number(bigCourseId);

        const quizResponses = await prisma.sisyaClassQuizResponse.findMany({
            where: { userId: userId, quiz: { session: { bigCourseId: courseId } } },
            include: { quiz: { include: { session: true } } },
            orderBy: { createdAt: 'asc' }
        });

        const sessionQuizzesMap = new Map<number, any>();

        quizResponses.forEach(resp => {
            const sessionId = resp.quiz.sessionId;
            if (!sessionQuizzesMap.has(sessionId)) {
                sessionQuizzesMap.set(sessionId, {
                    sessionId: sessionId,
                    sessionTitle: resp.quiz.session.detail,
                    sessionDate: resp.quiz.session.startTime,
                    quizzes: []
                });
            }

            sessionQuizzesMap.get(sessionId).quizzes.push({
                quizId: resp.quizId,
                isCorrect: resp.isCorrect,
                timeTaken: resp.timeTaken ? resp.timeTaken / 1000 : 0, // Convert ms to seconds
                submittedAt: resp.createdAt
            });
        });

        const details = Array.from(sessionQuizzesMap.values());

        res.status(200).json({ success: true, sessionQuizzes: details });
    } catch (error: any) {
        console.error("Error fetching quiz details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetStudentTestDetails(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body;

    if (!endUsersId || !bigCourseId) {
        return res.status(400).json({ success: false, message: "endUsersId and bigCourseId are required" });
    }

    try {
        const userId = Number(endUsersId);
        const courseId = Number(bigCourseId);

        const tests = await prisma.ctest.findMany({
            where: { bigCourseId: courseId },
            include: {
                ctestSubmission: {
                    where: { endUsersId: userId },
                    include: {
                        cTestResponse: {
                            include: { forQuestion: true }
                        }
                    }
                },
                _count: {
                    select: { ctestQuestions: true }
                }
            }
        });

        const details = await Promise.all(tests.map(async (test) => {
            const submission = test.ctestSubmission[0];
            const isMCQ = test.mode === 'MCQ';

            let maxMarks = test.totalMarks || 0;
            let marks = submission?.awardedMarks || 0;

            if (isMCQ && submission) {
                maxMarks = test._count.ctestQuestions;
                marks = submission.cTestResponse.filter(
                    resp => resp.response === resp.forQuestion.correctResponse
                ).length;
            } else if (isMCQ) {
                maxMarks = test._count.ctestQuestions;
            }

            let rank: number | null = null;
            if (submission) {
                const cacheKey = `test_leaderboard:${test.id}`;
                const cachedLeaderboard = await redis.get(cacheKey);
                let allScores: number[] = [];

                if (cachedLeaderboard) {
                    allScores = JSON.parse(cachedLeaderboard);
                } else {
                    const allSubmissions = await prisma.ctestSubmission.findMany({
                        where: { ctestId: test.id },
                        include: {
                            cTestResponse: {
                                include: { forQuestion: true }
                            }
                        }
                    });

                    allScores = allSubmissions.map(sub => {
                        if (isMCQ) {
                            return sub.cTestResponse.filter(
                                resp => resp.response === resp.forQuestion.correctResponse
                            ).length;
                        }
                        return sub.awardedMarks || 0;
                    });

                    allScores.sort((a, b) => b - a);
                    await redis.set(cacheKey, JSON.stringify(allScores), "EX", 300); // 5 mins cache
                }

                // Calculate rank (competition ranking: 1, 2, 2, 4)
                rank = allScores.filter(s => s > marks).length + 1;
            }

            return {
                testId: test.id,
                title: test.title,
                mode: test.mode,
                testDate: test.startDate,
                maxMarks,
                isAttempted: !!submission,
                marks,
                rank,
                status: submission?.status || null,
                submittedAt: submission?.submittedAt || null
            };
        }));

        res.status(200).json({ success: true, testDetails: details });
    } catch (error: any) {
        console.error("Error fetching test details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetStudentHomeworkDetails(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body;

    if (!endUsersId || !bigCourseId) {
        return res.status(400).json({ success: false, message: "endUsersId and bigCourseId are required" });
    }

    try {
        const userId = Number(endUsersId);
        const courseId = Number(bigCourseId);

        const sessionTests = await prisma.sessionTest.findMany({
            where: { createdFor: { bigCourseId: courseId } },
            orderBy: {
                createdFor: {
                    startTime: "desc"
                }
            },
            include: {
                sessionTestSubmission: {
                    where: { endUsersId: userId }
                },
                _count: {
                    select: { sessionTestQuestion: true }
                },
                createdFor: true
            }
        });

        const details = await Promise.all(sessionTests.map(async hw => {
            const submission = (hw as any).sessionTestSubmission?.[0];
            const maxMarks = (hw as any)._count?.sessionTestQuestion || 0;
            let marks = 0;

            if (submission) {
                const questions = await prisma.sessionTestQuestion.findMany({
                    where: { sessionTestId: hw.id },
                    select: { id: true, correctResponse: true }
                });
                const correctMap = new Map(questions.map(q => [q.id, q.correctResponse]));

                const responses = await prisma.sessionTestResponse.findMany({
                    where: {
                        endUsersId: userId,
                        sessionTestId: hw.id
                    }
                });

                marks = responses.filter(r => r.response === correctMap.get(r.sessionTestQuestionId)).length;
            }

            return {
                homeworkId: hw.id,
                sessionId: hw.sessionId,
                sessionName: (hw as any).createdFor?.detail || "",
                sessionDate: (hw as any).createdFor?.startTime || null,
                maxMarks,
                marks,
                isAttempted: !!submission,
                submittedAt: submission?.createdOn || null
            };
        }));

        res.status(200).json({ success: true, homeworkDetails: details });
    } catch (error: any) {
        console.error("Error fetching homework details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetStudentDoubtDetails(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body;

    if (!endUsersId || !bigCourseId) {
        return res.status(400).json({ success: false, message: "endUsersId and bigCourseId are required" });
    }

    try {
        const userId = Number(endUsersId);
        const courseId = Number(bigCourseId);

        // Fetching doubts asked by user in subjects related to the course
        const course = await prisma.bigCourse.findUnique({ where: { id: courseId }, select: { subjectList: true } });
        const subjectNames = await prisma.subject.findMany({
            where: { id: { in: course?.subjectList || [] } },
            select: { name: true }
        });
        const subjectNameList = subjectNames.map(s => s.name);

        const doubts = await prisma.doubt.findMany({
            where: {
                userId: userId,
                subject: { in: subjectNameList }
            },
            include: { doubtReview: true },
            orderBy: { createdOn: 'desc' }
        });

        const details = doubts.map(d => ({
            doubtId: d.id,
            description: d.description,
            subject: d.subject,
            topic: d.topic,
            status: d.status, // 0: pending, 1: assigned, 2: solved
            createdAt: d.createdOn,
            rating: d.doubtReview[0]?.rating || null,
            reviewComment: d.doubtReview[0]?.comment || null
        }));

        res.status(200).json({ success: true, doubtDetails: details });
    } catch (error: any) {
        console.error("Error fetching doubt details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetStudentCoinDetails(req: Request, res: Response) {
    const { endUsersId } = req.body;

    if (!endUsersId) {
        return res.status(400).json({ success: false, message: "endUsersId is required" });
    }

    try {
        const userId = Number(endUsersId);

        const wallet = await prisma.sisyaWallet.findUnique({
            where: {
                ownerType_ownerId: {
                    ownerType: 'ENDUSER',
                    ownerId: userId
                }
            }
        });

        if (!wallet) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const transactions = await prisma.sisyaTransaction.findMany({
            where: { walletId: wallet.id },
            orderBy: { createdAt: "desc" },
            include: {
                wallet: {
                    select: {
                        ownerType: true,
                        ownerId: true
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            data: transactions
        });
    } catch (error: any) {
        console.error("Error fetching coin details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetStudentReviewDetails(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body;

    if (!endUsersId) {
        return res.status(400).json({ success: false, message: "endUsersId is required" });
    }

    try {
        const userId = Number(endUsersId);
        const courseId = bigCourseId ? Number(bigCourseId) : undefined;

        // Build session feedback filter
        const sessionFeedbackWhere: any = { studentId: userId };
        if (courseId) {
            sessionFeedbackWhere.session = { bigCourseId: courseId };
        }

        // Fetch all types of reviews in parallel
        const [sessionFeedbacks, doubtReviews, mentorReviews, aiRatings] = await Promise.all([
            // Session Feedbacks
            prisma.sessionFeedback.findMany({
                where: sessionFeedbackWhere,
                include: {
                    session: {
                        select: {
                            id: true,
                            detail: true,
                            startTime: true,
                            bigCourseId: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            // Doubt Reviews
            prisma.doubtReview.findMany({
                where: { userId: userId },
                include: {
                    doubt: {
                        select: {
                            id: true,
                            description: true,
                            subject: true,
                            topic: true
                        }
                    },
                    mentor: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: { createdOn: 'desc' }
            }),
            // Mentor Reviews
            prisma.mentorRatings.findMany({
                where: { userId: userId },
                include: {
                    mentor: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: { createdOn: 'desc' }
            }),
            // AI Ratings
            prisma.aIRating.findMany({
                where: { userId: userId },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        const reviewDetails = {
            sessionFeedbacks: sessionFeedbacks.map(f => ({
                id: f.id,
                sessionId: f.sessionId,
                sessionTitle: f.session.detail,
                sessionDate: f.session.startTime,
                rating: f.rating,
                techIssue: f.techIssue,
                sessionIssue: f.sessionIssue,
                general: f.general,
                createdAt: f.createdAt
            })),
            doubtReviews: doubtReviews.map(r => ({
                id: r.id,
                doubtId: r.doubtId,
                doubtDescription: r.doubt.description,
                subject: r.doubt.subject,
                topic: r.doubt.topic,
                mentorName: r.mentor.name,
                rating: r.rating,
                comment: r.comment,
                createdOn: r.createdOn
            })),
            mentorReviews: mentorReviews.map(r => ({
                id: r.id,
                mentorId: r.mentorId,
                mentorName: r.mentor.name,
                rating: r.rating,
                comment: r.comment,
                createdOn: r.createdOn
            })),
            aiRatings: aiRatings.map(r => ({
                id: r.id,
                conversationId: r.conversationId,
                rating: r.rating,
                review: r.review,
                isVisible: r.isVisible,
                createdAt: r.createdAt
            })),
            summary: {
                totalSessionFeedbacks: sessionFeedbacks.length,
                totalDoubtReviews: doubtReviews.length,
                totalMentorReviews: mentorReviews.length,
                totalAIRatings: aiRatings.length,
                avgSessionRating: sessionFeedbacks.length > 0
                    ? parseFloat((sessionFeedbacks.reduce((acc, f) => acc + f.rating, 0) / sessionFeedbacks.length).toFixed(2))
                    : 0,
                avgDoubtRating: doubtReviews.length > 0
                    ? parseFloat((doubtReviews.reduce((acc, r) => acc + r.rating, 0) / doubtReviews.length).toFixed(2))
                    : 0,
                avgMentorRating: mentorReviews.length > 0
                    ? parseFloat((mentorReviews.reduce((acc, r) => acc + r.rating, 0) / mentorReviews.length).toFixed(2))
                    : 0,
                avgAIRating: aiRatings.length > 0
                    ? parseFloat((aiRatings.reduce((acc, r) => acc + r.rating, 0) / aiRatings.length).toFixed(2))
                    : 0
            }
        };

        res.status(200).json({ success: true, reviewDetails });
    } catch (error: any) {
        console.error("Error fetching review details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetSessionsByMentor(req: Request, res: Response) {
    const { mentorId } = req.body;

    if (!mentorId) {
        return res.status(400).json({ success: false, message: "mentorId is required" });
    }

    try {
        const id = Number(mentorId);

        const sessions = await prisma.session.findMany({
            where: { mentorId: id, isDone: true },
            orderBy: { startTime: "desc" },
            include: {
                course: { select: { id: true, name: true, grade: true } },
                subject: { select: { name: true } },
                SessionTest: { select: { id: true }, take: 1 },
                analytics: {
                    include: {
                        teacherAttendance: true,
                        studentIntervals: {
                            select: {
                                studentId: true,
                                student: { select: { isSisyaEmp: true } }
                            }
                        }
                    }
                },
                feedbacks: { select: { rating: true } }
            }
        });

        res.status(200).json({
            success: true,
            sessions: sessions.map(s => {
                const uniqueStudents = new Set(
                    s.analytics?.studentIntervals
                        .filter(i => !i.student.isSisyaEmp)
                        .map(i => i.studentId) || []
                );
                const avgRating = s.feedbacks.length > 0
                    ? s.feedbacks.reduce((acc, f) => acc + f.rating, 0) / s.feedbacks.length
                    : 0;

                return {
                    id: s.id,
                    title: s.detail,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    courseId: s.course.id,
                    courseName: s.course.name,
                    grade: s.course.grade,
                    subjectName: s.subject.name,
                    isDone: s.isDone,
                    isGoingOn: s.isGoingOn,
                    hasHomework: s.SessionTest.length > 0,
                    analytics: {
                        totalStudentsJoined: uniqueStudents.size,
                        avgRating: parseFloat(avgRating.toFixed(2)),
                        reviewCount: s.feedbacks.length,
                        isTakenByAssignedMentor: s.analytics?.teacherAttendance?.teacherId === id,
                        actualStartTime: s.analytics?.classStartTime || null,
                        actualEndTime: s.analytics?.classEndTime || null,
                        actualDuration: s.analytics?.actualDuration || 0,
                        teacherDuration: s.analytics?.teacherAttendance?.totalDuration || 0
                    }
                };
            })
        });
    } catch (error: any) {
        console.error("Error fetching sessions by mentor:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetMentorPerformanceSummary(req: Request, res: Response) {
    const { mentorId } = req.body;

    if (!mentorId) {
        return res.status(400).json({ success: false, message: "mentorId is required" });
    }

    try {
        const id = Number(mentorId);

        const [
            totalSessions,
            totalDuration,
            totalDoubtsAssigned,
            totalDoubtsSolved,
            sessionFeedbacks,
            doubtReviews,
            mentorRatings,
            wallet,
            roleLimit
        ] = await Promise.all([
            prisma.session.count({ where: { mentorId: id, isDone: true } }),
            prisma.sessionAnalytics.aggregate({
                _sum: { actualDuration: true },
                where: { session: { mentorId: id, isDone: true } }
            }),
            prisma.doubt.count({ where: { mentorId: id } }),
            prisma.doubt.count({ where: { mentorId: id, status: 2 } }),
            prisma.sessionFeedback.findMany({
                where: { session: { mentorId: id } },
                select: { rating: true }
            }),
            prisma.doubtReview.findMany({
                where: { mentorId: id },
                select: { rating: true }
            }),
            prisma.mentorRatings.findMany({
                where: { mentorId: id },
                select: { rating: true }
            }),
            prisma.sisyaWallet.findUnique({
                where: {
                    ownerType_ownerId: {
                        ownerType: "MENTOR",
                        ownerId: id
                    }
                }
            }),
            prisma.sisyaRewardLimit.findUnique({
                where: { role: "MENTOR" }
            })
        ]);

        let rewardBudgetDetails = null;

        if (wallet) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            const [todayUsage, monthUsage, userLimit] = await Promise.all([
                prisma.sisyaRewardUsage.findUnique({
                    where: {
                        walletId_date: {
                            walletId: wallet.id,
                            date: today
                        }
                    }
                }),
                prisma.sisyaRewardUsage.findMany({
                    where: {
                        walletId: wallet.id,
                        date: { gte: startOfMonth }
                    }
                }),
                prisma.sisyaRewardLimitUser.findUnique({
                    where: { walletId: wallet.id }
                })
            ]);

            const totalMonthUsage = monthUsage.reduce(
                (sum, usage) => sum.plus(usage.amountRewarded),
                new Decimal(0)
            );

            const effectiveDailyLimit = userLimit?.isActive
                ? userLimit.dailyLimit
                : (roleLimit?.isActive ? roleLimit.dailyLimit : new Decimal(0));

            const effectiveMonthlyLimit = userLimit?.isActive
                ? (userLimit.monthlyLimit || null)
                : (roleLimit?.isActive ? (roleLimit.monthlyLimit || null) : null);

            rewardBudgetDetails = {
                balance: wallet.rewardBudget,
                usage: {
                    today: todayUsage?.amountRewarded || new Decimal(0),
                    thisMonth: totalMonthUsage
                },
                limits: {
                    daily: effectiveDailyLimit,
                    monthly: effectiveMonthlyLimit
                }
            };
        }

        const avgSessionRating = sessionFeedbacks.length > 0
            ? sessionFeedbacks.reduce((acc, f) => acc + f.rating, 0) / sessionFeedbacks.length
            : 0;

        const avgDoubtRating = doubtReviews.length > 0
            ? doubtReviews.reduce((acc, r) => acc + r.rating, 0) / doubtReviews.length
            : 0;

        const avgMentorRating = mentorRatings.length > 0
            ? mentorRatings.reduce((acc, r) => acc + r.rating, 0) / mentorRatings.length
            : 0;

        const overallAvgRating = (avgSessionRating + avgDoubtRating + avgMentorRating) /
            ((avgSessionRating ? 1 : 0) + (avgDoubtRating ? 1 : 0) + (avgMentorRating ? 1 : 0) || 1);

        res.status(200).json({
            success: true,
            summary: {
                sessions: {
                    total: totalSessions,
                    totalDurationMinutes: totalDuration._sum.actualDuration || 0,
                    avgRating: parseFloat(avgSessionRating.toFixed(2))
                },
                doubts: {
                    assigned: totalDoubtsAssigned,
                    solved: totalDoubtsSolved,
                    solveRate: totalDoubtsAssigned > 0 ? parseFloat((totalDoubtsSolved / totalDoubtsAssigned).toFixed(3)) : 0,
                    avgRating: parseFloat(avgDoubtRating.toFixed(2))
                },
                ratings: {
                    mentorAvgRating: parseFloat(avgMentorRating.toFixed(2)),
                    overallAvgRating: parseFloat(overallAvgRating.toFixed(2)),
                    totalReviews: sessionFeedbacks.length + doubtReviews.length + mentorRatings.length
                },
                rewardBudget: rewardBudgetDetails
            }
        });
    } catch (error: any) {
        console.error("Error fetching mentor performance summary:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetMentorReviewDetails(req: Request, res: Response) {
    const { mentorId } = req.body;

    if (!mentorId) {
        return res.status(400).json({ success: false, message: "mentorId is required" });
    }

    try {
        const id = Number(mentorId);

        const [sessionFeedbacks, doubtReviews, mentorRatings] = await Promise.all([
            prisma.sessionFeedback.findMany({
                where: { session: { mentorId: id } },
                include: {
                    session: { select: { detail: true, startTime: true } },
                    student: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 50
            }),
            prisma.doubtReview.findMany({
                where: { mentorId: id },
                include: {
                    doubt: { select: { description: true, subject: true } },
                    user: { select: { name: true } }
                },
                orderBy: { createdOn: 'desc' },
                take: 50
            }),
            prisma.mentorRatings.findMany({
                where: { mentorId: id },
                include: {
                    user: { select: { name: true } }
                },
                orderBy: { createdOn: 'desc' },
                take: 50
            })
        ]);

        res.status(200).json({
            success: true,
            reviewDetails: {
                sessionFeedbacks: sessionFeedbacks.map(f => ({
                    id: f.id,
                    rating: f.rating,
                    comment: f.general,
                    studentName: f.student.name,
                    sessionTitle: f.session.detail,
                    date: f.session.startTime,
                    type: 'SESSION'
                })),
                doubtReviews: doubtReviews.map(r => ({
                    id: r.id,
                    rating: r.rating,
                    comment: r.comment,
                    studentName: r.user.name,
                    doubtDescription: r.doubt.description,
                    date: r.createdOn,
                    type: 'DOUBT'
                })),
                mentorRatings: mentorRatings.map(r => ({
                    id: r.id,
                    rating: r.rating,
                    comment: r.comment,
                    studentName: r.user.name,
                    date: r.createdOn,
                    type: 'DIRECT'
                }))
            }
        });
    } catch (error: any) {
        console.error("Error fetching mentor review details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetMentorDoubtDetails(req: Request, res: Response) {
    const { mentorId } = req.body;

    if (!mentorId) {
        return res.status(400).json({ success: false, message: "mentorId is required" });
    }

    try {
        const id = Number(mentorId);

        const doubts = await prisma.doubt.findMany({
            where: { mentorId: id },
            include: {
                asker: { select: { name: true } },
                doubtReview: { select: { rating: true, comment: true } }
            },
            orderBy: { createdOn: 'desc' }
        });

        const details = doubts.map(d => ({
            doubtId: d.id,
            description: d.description,
            subject: d.subject,
            topic: d.topic,
            status: d.status,
            studentName: d.asker.name,
            createdAt: d.createdOn,
            rating: d.doubtReview[0]?.rating || null,
            reviewComment: d.doubtReview[0]?.comment || null
        }));

        res.status(200).json({ success: true, doubtDetails: details });
    } catch (error: any) {
        console.error("Error fetching mentor doubt details:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetPresentStudents(req: Request, res: Response) {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ success: false, message: "sessionId is required" });
    }

    try {
        const students = await prisma.studentAttendanceInterval.findMany({
            where: {
                sessionAnalytics: {
                    sessionId: Number(sessionId)
                },
                student: {
                    isSisyaEmp: false
                }
            },
            distinct: ['studentId'],
            select: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                }
            }
        });

        res.status(200).json({
            success: true,
            students: students.map(s => s.student)
        });
    } catch (error: any) {
        console.error("Error fetching present students:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetSessionReviews(req: Request, res: Response) {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ success: false, message: "sessionId is required" });
    }

    try {
        const reviews = await prisma.sessionFeedback.findMany({
            where: {
                sessionId: Number(sessionId)
            },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json({
            success: true,
            reviews: reviews.map(r => ({
                id: r.id,
                rating: r.rating,
                techIssue: r.techIssue,
                sessionIssue: r.sessionIssue,
                general: r.general,
                createdAt: r.createdAt,
                student: r.student
            }))
        });
    } catch (error: any) {
        console.error("Error fetching session reviews:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

export async function GetMentorRewardTransactions(req: Request, res: Response) {
    const { mentorId, skip = 0, take = 50 } = req.body;

    if (!mentorId) {
        return res.status(400).json({ success: false, message: "mentorId is required" });
    }

    try {
        const id = Number(mentorId);

        const wallet = await prisma.sisyaWallet.findUnique({
            where: {
                ownerType_ownerId: {
                    ownerType: "MENTOR",
                    ownerId: id
                }
            }
        });

        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found for this mentor" });
        }

        const [spentTransactions, receivedTransactions, spentCount, receivedCount] = await Promise.all([
            prisma.sisyaTransaction.findMany({
                where: {
                    walletId: wallet.id,
                    type: "MANUAL_REWARD"
                },
                orderBy: { createdAt: "desc" },
                skip: Number(skip),
                take: Number(take)
            }),
            prisma.sisyaTransaction.findMany({
                where: {
                    walletId: wallet.id,
                    type: "MANUAL_REWARD_BUDGET"
                },
                orderBy: { createdAt: "desc" },
                skip: Number(skip),
                take: Number(take)
            }),
            prisma.sisyaTransaction.count({
                where: {
                    walletId: wallet.id,
                    type: "MANUAL_REWARD"
                }
            }),
            prisma.sisyaTransaction.count({
                where: {
                    walletId: wallet.id,
                    type: "MANUAL_REWARD_BUDGET"
                }
            })
        ]);

        // Enrich spent transactions (given to students)
        const enrichedSpent = await Promise.all(spentTransactions.map(async (tx) => {
            let studentName = null;
            const metadata = tx.metadata as any;
            if (metadata && metadata.toUserId) {
                const student = await prisma.endUsers.findUnique({
                    where: { id: Number(metadata.toUserId) },
                    select: { name: true }
                });
                if (student) studentName = student.name;
            }

            return {
                id: tx.id,
                amount: tx.amount,
                type: tx.type,
                balanceType: tx.balanceType,
                createdAt: tx.createdAt,
                reason: metadata?.reason || "No reason provided",
                studentName: studentName,
                studentId: metadata?.toUserId || null
            };
        }));

        // Enrich received transactions (budget allocated by admin)
        const enrichedReceived = await Promise.all(receivedTransactions.map(async (tx) => {
            let adminName = null;
            if (tx.initiatedByType === "ADMIN" && tx.initiatedById) {
                const admin = await prisma.admin.findUnique({
                    where: { id: Number(tx.initiatedById) },
                    select: { name: true }
                });
                if (admin) adminName = admin.name;
            }

            return {
                id: tx.id,
                amount: tx.amount,
                type: tx.type,
                balanceType: tx.balanceType,
                createdAt: tx.createdAt,
                reason: (tx.metadata as any)?.reason || "No reason provided",
                adminName: adminName,
                adminId: tx.initiatedById || null
            };
        }));

        res.status(200).json({
            success: true,
            data: {
                spent: {
                    data: enrichedSpent,
                    pagination: {
                        total: spentCount,
                        skip: Number(skip),
                        take: Number(take)
                    }
                },
                received: {
                    data: enrichedReceived,
                    pagination: {
                        total: receivedCount,
                        skip: Number(skip),
                        take: Number(take)
                    }
                }
            }
        });
    } catch (error: any) {
        console.error("Error fetching mentor reward transactions:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}
