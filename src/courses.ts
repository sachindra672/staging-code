import { prisma } from './misc'
import { Request, Response } from 'express'
import fs from 'fs';
import path from 'path';

export async function InsertCourse(req: Request, res: Response) {
    const { mentorId, comment, name, price, currentPrice, searchTags, grade, imageData, Subject } = req.body;
    const rating = 0.0;

    if (!mentorId) {
        return res.status(400).json({ success: false, cause: 'mentorId is required' });
    }
    if (!comment) {
        return res.status(400).json({ success: false, cause: 'comment is required' });
    }
    if (!name) {
        return res.status(400).json({ success: false, cause: 'name is required' });
    }
    if (price == null) {
        return res.status(400).json({ success: false, cause: 'price is required' });
    }
    if (currentPrice == null) {
        return res.status(400).json({ success: false, cause: 'currentPrice is required' });
    }
    if (!searchTags || !Array.isArray(searchTags)) {
        return res.status(400).json({ success: false, cause: 'searchTags must be a non-empty array' });
    }
    if (grade == null) {
        return res.status(400).json({ success: false, cause: 'grade is required' });
    }
    if (!imageData) {
        return res.status(400).json({ success: false, cause: 'imageData is required' });
    }

    try {
        // Create the course
        const course = await prisma.courses.create({
            data: {
                rating,
                mentorId,
                comment,
                name,
                price,
                currentPrice,
                searchTags,
                grade,
                Subject
            }
        });

        const imageBuffer = Buffer.from(imageData, 'base64');
        const imageDir = path.join(__dirname, '../thumbs/courses');
        const imagePath = path.join(imageDir, `${course.id}.jpg`);

        fs.mkdirSync(imageDir, { recursive: true });
        //@ts-ignore
        fs.writeFileSync(imagePath, imageBuffer);

        res.json({ succes: true, course });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error });
    }
}
export async function UpdateCourse(req: Request, res: Response) {
    const { id, comment, name, price, currentPrice, searchTags, grade } = req.body

    try {
        const course = await prisma.courses.update({
            where: {
                id
            },
            data: {
                comment,
                name,
                price,
                currentPrice,
                searchTags,
                grade
            }
        })
        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export async function GetCourseDetail(req: Request, res: Response) {
    const { id } = req.body

    try {
        const course = await prisma.courses.findUnique({ where: { id }, include: { courseRatings: true, lessons: true } })

        res.json({ success: true, course })
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export async function GetCoursesByGrade(req: Request, res: Response) {
    const { grade } = req.body
    console.log(req.body)

    if (!grade) {
        return res.status(400).send("invalid grade")
    }

    try {
        const course = await prisma.courses.findMany({ where: { grade }, include: { lessons: true } })

        return res.json({ success: true, course })
    } catch (error) {
        return res.json({ success: false, cause: error })
    }
}

export async function InsertCourseRating(req: Request, res: Response) {
    const { title, subject, userId, coursesId } = req.body
    const averageRating = 0.0
    try {
        const course = await prisma.courseRatings.create({
            data: {
                title,
                subject,
                averageRating,
                userId,
                coursesId
            }
        })
        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export async function UpdateCourseRating(req: Request, res: Response) {
    const { id, title, subject, coursesId } = req.body
    const averageRating = 0.0
    try {
        const course = await prisma.courseRatings.update({
            where: { id },
            data: {
                title,
                subject,
                averageRating,
                coursesId
            }
        })
        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export async function GetTeacherCourses(req: Request, res: Response) {
    const { mentorId } = req.body
    try {
        const course = await prisma.courseRatings.findMany({ where: { mentorId } })
        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export const getMentorCourses = async (req: Request, res: Response) => {
    try {
        const { mentorId, page = 1, limit = 10 } = req.body;

        // validation
        if (!mentorId || isNaN(Number(mentorId))) {
            return res.status(400).json({
                success: false,
                message: "Valid mentorId is required"
            });
        }

        const mentorIdNum = Number(mentorId);

        // pagination safety
        const safeLimit = Math.min(Number(limit), 50);
        const safePage = Math.max(Number(page), 1);

        const skip = (safePage - 1) * safeLimit;

        const [courses, total] = await Promise.all([

            prisma.bigCourse.findMany({
                where: {
                    mentorList: {
                        has: mentorIdNum
                    },
                    isActive: true
                },

                select: {
                    id: true,
                    name: true,
                    isLongTerm:true,
                    isFree: true,
                    startDate: true,
                    endDate: true
                },

                orderBy: {
                    createdOn: "desc"
                },

                skip,
                take: safeLimit
            }),

            prisma.bigCourse.count({
                where: {
                    mentorList: {
                        has: mentorIdNum
                    },
                    isActive: true
                }
            })

        ]);

        // response
        return res.status(200).json({
            success: true,
            page: safePage,
            limit: safeLimit,
            totalRecords: total,
            totalPages: Math.ceil(total / safeLimit),
            data: courses
        });

    } catch (error) {

        console.error("Get Mentor Courses Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// export const getMentorCoursesWithSessions = async (req: Request, res: Response) => {
//     try {

//         const { mentorId } = req.body;

//         // Validation
//         if (!mentorId || isNaN(Number(mentorId))) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Valid mentorId is required"
//             });
//         }

//         const mentorIdNum = Number(mentorId);

//         const courses = await prisma.bigCourse.findMany({

//             where: {
//                 mentorList: {
//                     has: mentorIdNum
//                 },
//                 isActive: true
//             },

//             select: {
//                 id: true,
//                 name: true,
//                 isLongTerm: true,
//                 isFree: true,
//                 startDate: true,
//                 endDate: true,

//                 _count: {
//                     select: {
//                         mgSubsciption: true
//                     }
//                 },

//                 session: {
//                     where: {
//                         mentorId: mentorIdNum
//                     },

//                     select: {
//                         id: true,
//                         startTime: true,
//                         endTime: true,
//                         isDone: true,
//                         isGoingOn: true,

//                         subject: {
//                             select: {
//                                 id: true,
//                                 name: true
//                             }
//                         },

//                         _count: {
//                             select: {
//                                 SessionTest: true
//                             }
//                         }
//                     },

//                     orderBy: {
//                         startTime: "desc"
//                     }
//                 }
//             },

//             orderBy: {
//                 createdOn: "desc"
//             }
//         });

//         // Format response
//         const formattedData = courses.map(course => ({
//             id: course.id,
//             name: course.name,
//             isLongTerm: course.isLongTerm,
//             isFree: course.isFree,
//             startDate: course.startDate,
//             endDate: course.endDate,

//             enrolledStudents: course._count.mgSubsciption,

//             session: course.session.map(s => ({
//                 id: s.id,
//                 startTime: s.startTime,
//                 endTime: s.endTime,
//                 isDone: s.isDone,
//                 isGoingOn: s.isGoingOn,

//                 subject: s.subject,

//                 homeworkUpload: s._count.SessionTest > 0
//             }))
//         }));

//         return res.status(200).json({
//             success: true,
//             totalCourses: formattedData.length,
//             data: formattedData
//         });

//     } catch (error) {

//         console.error("Get Mentor Courses With Sessions Error:", error);

//         return res.status(500).json({
//             success: false,
//             message: "Internal server error"
//         });
//     }
// };

export const getMentorCoursesWithSessions = async (req: Request, res: Response) => {
    try {

        const { mentorId } = req.body;

        // Validation
        if (!mentorId || isNaN(Number(mentorId))) {
            return res.status(400).json({
                success: false,
                message: "Valid mentorId is required"
            });
        }

        const mentorIdNum = Number(mentorId);

        const courses = await prisma.bigCourse.findMany({

            where: {
                mentorList: {
                    has: mentorIdNum
                },
                isActive: true
            },

            select: {
                id: true,
                name: true,
                isLongTerm: true,
                isFree: true,
                startDate: true,
                endDate: true,
                grade:true,
                subjectList:true,

                _count: {
                    select: {
                        mgSubsciption: true
                    }
                },

                session: {
                    where: {
                        mentorId: mentorIdNum
                    },

                    select: {
                        id: true,
                        detail:true,
                        startTime: true,
                        endTime: true,
                        isDone: true,
                        isGoingOn: true,
                        vmIp:true,
                        subject: {
                            select: {
                                id: true,
                                name: true
                            }
                        },

                        // Fetch homework ID (minimal)
                       SessionTest: {
            select: {
                id: true,
                startTime: true,
                endTime: true,
                duration: true,
                modifiedOn: true,
                createdOn: true,
                sessionId: true,
                mentorId: true,

                sessionTestQuestion: {
                    select: {
                        id: true,
                        type: true,
                        question: true,
                        option1: true,
                        option2: true,
                        option3: true,
                        option4: true,
                        correctResponse: true,
                        sessionTestId: true,
                        modifiedOn: true,
                        createdOn: true
                    }
                }
            }
        },

                        _count: {
                            select: {
                                SessionTest: true
                            }
                        }
                    },

                    orderBy: {
                        startTime: "desc"
                    }
                }
            },

            orderBy: {
                createdOn: "desc"
            }
        });

        // Format response
        const formattedData = courses.map(course => ({
            id: course.id,
            name: course.name,
            isLongTerm: course.isLongTerm,
            isFree: course.isFree,
            startDate: course.startDate,
            endDate: course.endDate,
            grade:course.grade,
            subjects:course.subjectList,

            enrolledStudents: course._count.mgSubsciption,

            session: course.session.map(s => {

                const hasHomework = s._count.SessionTest > 0;

                return {
                    id: s.id,
                    name:s.detail,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    isDone: s.isDone,
                    isGoingOn: s.isGoingOn,
                    vmIp: s.vmIp,
                    subject: s.subject,
                    
                    homeworkUpload: hasHomework,
                    sessionTest : hasHomework? s.SessionTest:null,
                    // Send only if exists
                    sessionTestId: hasHomework ? s.SessionTest[0]?.id : null,
                    
                };
            })
        }));

        return res.status(200).json({
            success: true,
            totalCourses: formattedData.length,
            data: formattedData
        });

    } catch (error) {

        console.error("Get Mentor Courses With Sessions Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

export async function GetBigCoursesByGrade(req: Request, res: Response) {
    const { grade } = req.body;

    try {
        if (!grade) {
            return res.status(400).json({
                success: false,
                error: "grade is missing",
            });
        }

        const courses = await prisma.bigCourse.findMany({
            where: {
                grade,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                isLongTerm: true,
                isFree: true,
            },
            orderBy: {
                startDate: "desc",
            },
        });

        return res.status(200).json({
            success: true,
            courses,
        });
    } catch (error) {
        console.error("GetBigCoursesByGrade Error:", error);

        return res.status(500).json({
            success: false,
            error: "Internal Server Error",
        });
    }
}