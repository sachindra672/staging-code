import { Request, Response } from "express";
import { prisma, redis } from "./misc";

/**
 * Admin Dashboard Overview - Key metrics summary
 * Returns: Total students, courses, sessions, tests, avg ratings
 */
export async function GetAdminDashboardOverview(_req: Request, res: Response) {
    try {
        const cacheKey = "admin_dashboard_overview";
        const cached = await redis.get(cacheKey);

        if (cached) {
            return res.status(200).json({ success: true, data: JSON.parse(cached) });
        }

        const [
            totalStudents,
            totalCourses,
            totalSessions,
            totalTests,
            totalHomework,
            avgCourseRating,
            totalDoubts,
            solvedDoubts
        ] = await Promise.all([
            prisma.endUsers.count({ where: { isActive: true, isSisyaEmp: false } }),
            prisma.bigCourse.count({ where: { isActive: true } }),
            prisma.session.count({ where: { isDone: true } }),
            prisma.ctest.count(),
            prisma.sessionTest.count(),
            prisma.bigCourse.aggregate({
                _avg: { averageRating: true },
                where: { isActive: true }
            }),
            prisma.doubt.count(),
            prisma.doubt.count({ where: { status: 2 } })
        ]);

        const data = {
            totalStudents,
            totalCourses,
            totalSessions,
            totalTests,
            totalHomework,
            avgCourseRating: parseFloat((avgCourseRating._avg.averageRating || 0).toFixed(2)),
            doubts: {
                total: totalDoubts,
                solved: solvedDoubts,
                solveRate: totalDoubts > 0 ? parseFloat((solvedDoubts / totalDoubts).toFixed(3)) : 0
            }
        };

        await redis.set(cacheKey, JSON.stringify(data), "EX", 300); // 5 min cache
        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("Error fetching dashboard overview:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

/**
 * Student Enrollment Trends - Enrollments over time
 * Query params: days (default: 30)
 * Returns: Daily enrollment counts
 */
export async function GetEnrollmentTrends(req: Request, res: Response) {
    const { days = 30 } = req.query;

    try {
        const daysCount = Math.min(Number(days), 365); // Max 1 year
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);

        const enrollments = await prisma.mgSubsciption.groupBy({
            by: ['createdAt'],
            where: {
                createdAt: { gte: startDate },
                isActive: true,
                user: { isActive: true, isSisyaEmp: false }
            },
            _count: { id: true }
        });

        // Group by date (day level)
        const dailyData = new Map<string, number>();
        enrollments.forEach(e => {
            const dateKey = e.createdAt.toISOString().split('T')[0];
            dailyData.set(dateKey, (dailyData.get(dateKey) || 0) + e._count.id);
        });

        const trends = Array.from(dailyData.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        res.status(200).json({ success: true, data: trends });
    } catch (error: any) {
        console.error("Error fetching enrollment trends:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

/**
 * Session Analytics Over Time
 * Query params: days (default: 30)
 * Returns: Daily session counts, avg attendance, avg ratings
 */
export async function GetSessionTrends(req: Request, res: Response) {
    const { days = 30 } = req.query;

    try {
        const daysCount = Math.min(Number(days), 365);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);

        const sessions = await prisma.session.findMany({
            where: {
                isDone: true,
                startTime: { gte: startDate }
            },
            select: {
                startTime: true,
                analytics: {
                    select: {
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

        // Group by date
        const dailyStats = new Map<string, { count: number; totalStudents: number; totalRating: number; ratingCount: number }>();

        sessions.forEach(s => {
            const dateKey = s.startTime.toISOString().split('T')[0];
            const stats = dailyStats.get(dateKey) || { count: 0, totalStudents: 0, totalRating: 0, ratingCount: 0 };

            stats.count++;
            const uniqueStudents = new Set(
                s.analytics?.studentIntervals
                    .filter(i => !i.student.isSisyaEmp)
                    .map(i => i.studentId) || []
            );
            stats.totalStudents += uniqueStudents.size;

            s.feedbacks.forEach(f => {
                stats.totalRating += f.rating;
                stats.ratingCount++;
            });

            dailyStats.set(dateKey, stats);
        });

        const trends = Array.from(dailyStats.entries())
            .map(([date, stats]) => ({
                date,
                sessionCount: stats.count,
                avgAttendance: stats.count > 0 ? parseFloat((stats.totalStudents / stats.count).toFixed(2)) : 0,
                avgRating: stats.ratingCount > 0 ? parseFloat((stats.totalRating / stats.ratingCount).toFixed(2)) : 0
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        res.status(200).json({ success: true, data: trends });
    } catch (error: any) {
        console.error("Error fetching session trends:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

/**
 * Course-wise Performance Summary
 * Returns: Top courses by enrollment, rating, session count
 */
export async function GetCoursePerformanceStats(_req: Request, res: Response) {
    try {
        const cacheKey = "admin_course_performance";
        const cached = await redis.get(cacheKey);

        if (cached) {
            return res.status(200).json({ success: true, data: JSON.parse(cached) });
        }

        const courses = await prisma.bigCourse.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                grade: true,
                averageRating: true,
                _count: {
                    select: {
                        mgSubsciption: true,
                        session: true,
                        ctest: true
                    }
                }
            },
            take: 20,
            orderBy: { mgSubsciption: { _count: 'desc' } }
        });

        const data = courses.map(c => ({
            courseId: c.id,
            courseName: c.name,
            grade: c.grade,
            enrollmentCount: c._count.mgSubsciption,
            sessionCount: c._count.session,
            testCount: c._count.ctest,
            avgRating: parseFloat((c.averageRating || 0).toFixed(2))
        }));

        await redis.set(cacheKey, JSON.stringify(data), "EX", 600); // 10 min cache
        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("Error fetching course performance:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

/**
 * Test & Homework Completion Rates
 * Returns: Aggregated completion rates for tests and homework
 */
export async function GetAssessmentCompletionStats(_req: Request, res: Response) {
    try {
        const cacheKey = "admin_assessment_completion";
        const cached = await redis.get(cacheKey);

        if (cached) {
            return res.status(200).json({ success: true, data: JSON.parse(cached) });
        }

        const [
            totalTests,
            totalTestSubmissions,
            totalHomework,
            totalHomeworkSubmissions,
            totalStudents
        ] = await Promise.all([
            prisma.ctest.count(),
            prisma.ctestSubmission.count(),
            prisma.sessionTest.count(),
            prisma.sessionTestSubmission.count(),
            prisma.endUsers.count({ where: { isActive: true, isSisyaEmp: false } })
        ]);

        const data = {
            tests: {
                total: totalTests,
                totalSubmissions: totalTestSubmissions,
                avgCompletionRate: totalTests > 0 && totalStudents > 0
                    ? parseFloat((totalTestSubmissions / (totalTests * totalStudents)).toFixed(3))
                    : 0
            },
            homework: {
                total: totalHomework,
                totalSubmissions: totalHomeworkSubmissions,
                avgCompletionRate: totalHomework > 0 && totalStudents > 0
                    ? parseFloat((totalHomeworkSubmissions / (totalHomework * totalStudents)).toFixed(3))
                    : 0
            }
        };

        await redis.set(cacheKey, JSON.stringify(data), "EX", 600);
        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("Error fetching assessment completion stats:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

/**
 * Mentor Performance Summary
 * Returns: Top mentors by session count, ratings
 */
export async function GetMentorPerformanceStats(_req: Request, res: Response) {
    try {
        const cacheKey = "admin_mentor_performance";
        const cached = await redis.get(cacheKey);

        if (cached) {
            return res.status(200).json({ success: true, data: JSON.parse(cached) });
        }

        const mentors = await prisma.mentor.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                _count: {
                    select: {
                        session: { where: { isDone: true } },
                        doubt: true,
                        doubtReviews: true
                    }
                }
            },
            take: 20,
            orderBy: { session: { _count: 'desc' } }
        });

        const enrichedMentors = await Promise.all(mentors.map(async (m) => {
            const [sessionFeedbacks, doubtReviews] = await Promise.all([
                prisma.sessionFeedback.aggregate({
                    _avg: { rating: true },
                    where: { session: { mentorId: m.id } }
                }),
                prisma.doubtReview.aggregate({
                    _avg: { rating: true },
                    where: { mentorId: m.id }
                })
            ]);

            return {
                mentorId: m.id,
                mentorName: m.name,
                sessionCount: m._count.session,
                doubtCount: m._count.doubt,
                avgSessionRating: parseFloat((sessionFeedbacks._avg.rating || 0).toFixed(2)),
                avgDoubtRating: parseFloat((doubtReviews._avg.rating || 0).toFixed(2))
            };
        }));

        await redis.set(cacheKey, JSON.stringify(enrichedMentors), "EX", 600);
        res.status(200).json({ success: true, data: enrichedMentors });
    } catch (error: any) {
        console.error("Error fetching mentor performance:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

/**
 * Doubt Resolution Trends
 * Query params: days (default: 30)
 * Returns: Daily doubt creation and resolution stats
 */
export async function GetDoubtTrends(req: Request, res: Response) {
    const { days = 30 } = req.query;

    try {
        const daysCount = Math.min(Number(days), 365);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);

        const doubts = await prisma.doubt.findMany({
            where: { createdOn: { gte: startDate } },
            select: {
                createdOn: true,
                status: true
            }
        });

        const dailyStats = new Map<string, { created: number; solved: number }>();

        doubts.forEach(d => {
            const dateKey = d.createdOn.toISOString().split('T')[0];
            const stats = dailyStats.get(dateKey) || { created: 0, solved: 0 };
            stats.created++;
            if (d.status === 2) stats.solved++;
            dailyStats.set(dateKey, stats);
        });

        const trends = Array.from(dailyStats.entries())
            .map(([date, stats]) => ({
                date,
                created: stats.created,
                solved: stats.solved,
                solveRate: stats.created > 0 ? parseFloat((stats.solved / stats.created).toFixed(3)) : 0
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        res.status(200).json({ success: true, data: trends });
    } catch (error: any) {
        console.error("Error fetching doubt trends:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}


/**
 * Rating Distribution
 * Returns: Distribution of ratings across sessions, doubts, mentors
 */
export async function GetRatingDistribution(_req: Request, res: Response) {
    try {
        const cacheKey = "admin_rating_distribution";
        const cached = await redis.get(cacheKey);

        if (cached) {
            return res.status(200).json({ success: true, data: JSON.parse(cached) });
        }

        const [sessionRatings, doubtRatings, mentorRatings] = await Promise.all([
            prisma.sessionFeedback.groupBy({
                by: ['rating'],
                _count: { rating: true }
            }),
            prisma.doubtReview.groupBy({
                by: ['rating'],
                _count: { rating: true }
            }),
            prisma.mentorRatings.groupBy({
                by: ['rating'],
                _count: { rating: true }
            })
        ]);

        const createDistribution = (ratings: any[]) => {
            const dist = [0, 0, 0, 0, 0]; // 1-5 stars
            ratings.forEach(r => {
                if (r.rating >= 1 && r.rating <= 5) {
                    dist[r.rating - 1] = r._count.rating;
                }
            });
            return dist;
        };

        const data = {
            sessionRatings: createDistribution(sessionRatings),
            doubtRatings: createDistribution(doubtRatings),
            mentorRatings: createDistribution(mentorRatings)
        };

        await redis.set(cacheKey, JSON.stringify(data), "EX", 600);
        res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error("Error fetching rating distribution:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}

/**
 * Recent Activity Feed
 * Returns: Sorted list of recent platform activities
 */
export async function GetRecentActivity(req: Request, res: Response) {
    const limit = Number(req.body.limit) || 50;
    // Limit per category to avoid over-fetching before merge
    const fetchLimit = limit;

    try {
        const [
            users,
            enrollments,
            sessionAnalytics,
            doubts,
            homeworks,
            ctests,
            homeworkSubmissions,
            ctestSubmissions
        ] = await Promise.all([
            // 1. New Signups
            prisma.endUsers.findMany({
                take: fetchLimit,
                orderBy: { createdOn: 'desc' },
                select: { id: true, name: true, createdOn: true, type: true }
            }),
            // 2. Enrollments
            prisma.mgSubsciption.findMany({
                take: fetchLimit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { id: true, name: true } },
                    course: { select: { id: true, name: true } }
                }
            }),
            // 3. Session Analytics (Completed Sessions)
            prisma.sessionAnalytics.findMany({
                take: fetchLimit,
                orderBy: { createdAt: 'desc' },
                include: {
                    session: {
                        select: {
                            id: true,
                            detail: true,
                            course: { select: { name: true } }
                        }
                    }
                }
            }),
            // 4. Doubts
            prisma.doubt.findMany({
                take: fetchLimit,
                orderBy: { createdOn: 'desc' },
                include: {
                    asker: { select: { id: true, name: true } },
                    subjectRecord: { include: { subject: true } }
                }
            }),
            // 5. Homework Created
            prisma.sessionTest.findMany({
                take: fetchLimit,
                orderBy: { createdOn: 'desc' },
                include: {
                    createdFor: { select: { detail: true } },
                    createdBy: { select: { name: true } }
                }
            }),
            // 6. CTest Created
            prisma.ctest.findMany({
                take: fetchLimit,
                orderBy: { createdOn: 'desc' },
                select: { id: true, title: true, createdOn: true, mentor: { select: { name: true } } }
            }),
            // 7. Homework Submissions
            prisma.sessionTestSubmission.findMany({
                take: fetchLimit,
                orderBy: { createdOn: 'desc' },
                include: {
                    user: { select: { id: true, name: true } },
                    test: { include: { createdFor: { select: { detail: true } } } }
                }
            }),
            // 8. CTest Submissions
            prisma.ctestSubmission.findMany({
                take: fetchLimit,
                orderBy: { createdOn: 'desc' },
                include: {
                    user: { select: { id: true, name: true } },
                    ctest: { select: { title: true } }
                }
            })
        ]);

        const activities: any[] = [];

        // Map Users
        users.forEach(u => activities.push({
            type: 'USER_SIGNUP',
            timestamp: u.createdOn,
            description: `New user signup: ${u.name || 'Unknown'} (${u.type})`,
            metadata: { userId: u.id, userType: u.type }
        }));

        // Map Enrollments
        enrollments.forEach(e => activities.push({
            type: 'ENROLLMENT',
            timestamp: e.createdAt,
            description: `${e.user.name} enrolled in ${e.course.name}`,
            metadata: { userId: e.user.id, courseId: e.course.id }
        }));

        // Map Session Analytics
        sessionAnalytics.forEach(s => activities.push({
            type: 'SESSION_COMPLETED',
            timestamp: s.createdAt,
            description: `Session completed: ${s.session?.detail || 'Unknown'} (${s.session?.course?.name})`,
            metadata: { sessionId: s.sessionId, duration: s.actualDuration }
        }));

        // Map Doubts
        doubts.forEach(d => activities.push({
            type: 'DOUBT_CREATED',
            timestamp: d.createdOn,
            description: `${d.asker.name} asked a doubt${d.subjectRecord.length > 0 && d.subjectRecord[0].subject ? ' in ' + d.subjectRecord[0].subject.name : ''}`,
            metadata: { doubtId: d.id, studentId: d.asker.id }
        }));

        // Map Homework Created
        homeworks.forEach(h => activities.push({
            type: 'HOMEWORK_CREATED',
            timestamp: h.createdOn,
            description: `Homework added for session: ${h.createdFor.detail}`,
            metadata: { testId: h.id }
        }));

        // Map CTest Created
        ctests.forEach(c => activities.push({
            type: 'CTEST_CREATED',
            timestamp: c.createdOn,
            description: `New Test created: ${c.title} by ${c.mentor.name}`,
            metadata: { testId: c.id }
        }));

        // Map Homework Submissions
        homeworkSubmissions.forEach(h => activities.push({
            type: 'HOMEWORK_SUBMITTED',
            timestamp: h.createdOn,
            description: `${h.user.name} submitted homework for ${h.test.createdFor.detail}`,
            metadata: { submissionId: h.id, studentId: h.user.id }
        }));

        // Map CTest Submissions
        ctestSubmissions.forEach(c => activities.push({
            type: 'CTEST_SUBMITTED',
            timestamp: c.createdOn,
            description: `${c.user.name} submitted test: ${c.ctest.title}`,
            metadata: { submissionId: c.id, studentId: c.user.id }
        }));

        // Sort by timestamp desc and take top N
        const sortedActivities = activities
            .sort((a, b) => {
                const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return timeB - timeA;
            })
            .slice(0, limit);

        res.status(200).json({ success: true, data: sortedActivities });

    } catch (error: any) {
        console.error("Error fetching recent activity:", error);
        res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
}
