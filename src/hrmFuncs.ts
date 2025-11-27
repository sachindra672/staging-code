import { generateAccessTokenUser, prisma } from './misc'
import { Request, Response } from 'express'
import { teacherAttendanceRecord } from '@prisma/client'



export async function getSalesmanById(req: Request, res: Response) {
    const { id } = req.body

    try {
        const salesman = await prisma.salesman.findFirst({ where: { id } })
        res.json({ success: true, salesman })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

export async function markLogin(req: Request, res: Response) {
    const { mentorId } = req.body

    try {
        const record = await prisma.teacherAttendanceRecord.create({ data: { mentorId, loginTime: new Date(), status: "present" } })
        res.json({ success: true, record })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

export async function markLogout(req: Request, res: Response) {
    const { mentorId } = req.body

    try {

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0); // Set to start of today

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999); // Set to end of today

        const latestAttendance = await prisma.teacherAttendanceRecord.findFirstOrThrow({
            where: {
                mentorId,
                loginTime: {
                    gte: startOfToday,
                    lte: endOfToday,
                },
            },
            orderBy: {
                createOn: 'desc',
            },
        });


        const record = prisma.teacherAttendanceRecord.update({ where: { id: latestAttendance.id }, data: { logoutTime: new Date(), status: "present" } })
        res.json({ success: true, record })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}
// this function/route has to be run at the end of the day. 
// it will bring out list of all logins by mentorIds and diff them 
// from complete list and mark others as absent 
// TODO: optimize it to perform bulk insert on prepared objects
export async function DayScan(_: Request, res: Response) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0); // Set to start of today

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999); // Set to end of today
    try {

        const Allmentors = (await prisma.mentor.findMany({ select: { id: true } })).map(e => e.id)
        const todaysAttendances = await prisma.teacherAttendanceRecord.findMany({
            where: {
                loginTime: {
                    gte: startOfToday,
                    lte: endOfToday,
                },
            },
            orderBy: {
                createOn: 'desc',
            },
        });

        if (!todaysAttendances || todaysAttendances.length == 0) {
            res.status(500).json({ success: false, message: "no current day attendances found" })
            return
        }
        const presentMentors = todaysAttendances.map(e => e.mentorId)
        const absentMentors: number[] = []

        for (const mentor of Allmentors) {
            if (!presentMentors.includes(mentor)) {
                absentMentors.push(mentor)
            }
        }
        const promises: Promise<teacherAttendanceRecord>[] = []
        absentMentors.forEach(absentMentorId => {
            promises.push(prisma.teacherAttendanceRecord.create({ data: { mentorId: absentMentorId, status: "absent" } }))
        });

        const absenteeRecords = await Promise.all(promises)
        res.json({ success: true, absenteeRecords })

    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

export async function hrLogin(req: Request, res: Response) {
    const { email, password } = req.body

    try {
        const hr = await prisma.hrManager.findFirst({ where: { email, password } })
        if (!hr) {
            res.status(404).json({ success: false, message: "user not found" })
            return
        }

        const token = generateAccessTokenUser({ hr })

        res.json({ success: true, token })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

export async function createHr(req: Request, res: Response) {
    const { email, password } = req.body

    try {
        const hr = await prisma.hrManager.create({ data: { email, password } })

        res.json({ success: true, hr })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

export async function CreateLeaveReq(req: Request, res: Response) {
    const { startDate, endDate, reason, mentorId } = req.body
    try {
        const leaveRequest = await prisma.leaves.create({ data: { startDate, endDate, reason, mentorId } })
        res.json({ success: true, req: leaveRequest })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

export async function GetMyLeaves(req: Request, res: Response) {
    const { mentorId } = req.body

    try {
        const leaves = await prisma.leaves.findMany({ where: { mentorId } })
        res.json({ success: true, leaves })
    } catch (error) {
        res.status(500).json({ success: false, error })

    }
}

export async function DenyLeaveReq(req: Request, res: Response) {
    const { id, actor } = req.body

    try {
        const update = await prisma.leaves.update({ where: { id }, data: { status: "denied", actor } })
        res.json({ success: true, update })

    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}


export async function ApproveLeaveReq(req: Request, res: Response) {
    const { id, actor } = req.body // actor is email of the HR approving the request

    try {
        const update = await prisma.leaves.update({ where: { id }, data: { status: "accepted", actor } })
        const leaveDayList = GetLeaveDayList(update.startDate, update.endDate)

        for (const leaveDay of leaveDayList) {
            await prisma.teacherAttendanceRecord.create(
                {
                    data:
                    {
                        mentorId: update.mentorId,
                        loginTime: leaveDay,
                        logoutTime: leaveDay,
                        status: "leave",
                        createOn: leaveDay,
                        updateOn: leaveDay
                    }
                })
        }
        res.json({ success: true, update })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, error })
    }
}

function GetLeaveDayList(startDate: Date, endDate: Date) {
    let start = new Date(startDate);
    let end = new Date(endDate);
    let dates = [];

    while (start <= end) {
        dates.push(new Date(start));
        start.setDate(start.getDate() + 1);
    }

    return dates;
}

export async function CreateDefaultHolidays(req: Request, res: Response) {
    const { day, occasion, otherInfor } = req.body

    try {
        const holiday = await prisma.defaultHolidays.create({ data: { day, occasion, otherInfor } })
        res.json({ success: true, holiday })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}


export async function getAllPendingLeaves(_: Request, res: Response) {
    try {
        const leaveRequests = await prisma.leaves.findMany()
        res.json({ success: true, leaveRequests })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}


export async function getLeavesByMentorId(req: Request, res: Response) {
    const { mentorId } = req.body
    try {
        const leaveRequests = await prisma.leaves.findMany({ where: { mentorId } })
        res.json({ success: true, leaveRequests })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

export async function getAllHolidays(_: Request, res: Response) {
    try {
        const leaveRequests = await prisma.defaultHolidays.findMany()
        res.json({ success: true, leaveRequests })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

// TODO add paging
export async function getAllAttendanceRecords(_: Request, res: Response) {
    try {
        const records = await prisma.teacherAttendanceRecord.findMany()
        res.json({ success: true, records })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

export async function getAllAttendanceRecordsByMentor(req: Request, res: Response) {
    const { mentorId } = req.body
    try {
        const records = await prisma.teacherAttendanceRecord.findMany({ where: { mentorId } })
        res.json({ success: true, records })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

export async function getDateRangeRecords(req: Request, res: Response) {
    const { mentorId, startDate, endDate } = req.body
    try {
        const records = await prisma.teacherAttendanceRecord.findMany({
            where: {
                mentorId, loginTime: {
                    gte: startDate,
                    lte: endDate,
                }
            }
        })

        res.json({ success: true, records })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}