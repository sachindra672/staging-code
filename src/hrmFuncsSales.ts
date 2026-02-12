import { prisma } from './misc'
import { Request, Response } from 'express'

export async function markLoginSales(req: Request, res: Response) {
    const { salesmanId } = req.body

    try {
        const record = await prisma.salesManAttendanceRecord.create({ data: { salesmanId, loginTime: new Date(), status: "present" } })
        res.json({ success: true, record })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

export async function markLogoutSales(req: Request, res: Response) {
    const { salesmanId } = req.body

    try {

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0); // Set to start of today

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999); // Set to end of today

        const latestAttendance = await prisma.salesManAttendanceRecord.findFirstOrThrow({
            where: {
                salesmanId,
                loginTime: {
                    gte: startOfToday,
                    lte: endOfToday,
                },
            },
            orderBy: {
                createOn: 'desc',
            },
        });


        const record = prisma.salesManAttendanceRecord.update({ where: { id: latestAttendance.id }, data: { logoutTime: new Date(), status: "present" } })
        res.json({ success: true, record })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

export async function CreateLeaveReqSales(req: Request, res: Response) {
    const { startDate, endDate, reason, salesmanId } = req.body
    try {
        const leaveRequest = await prisma.salesleaves.create({ data: { startDate, endDate, reason, salesmanId } })
        res.json({ success: true, req: leaveRequest })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

export async function GetMyLeavesSales(req: Request, res: Response) {
    const { salesmanId } = req.body

    try {
        const leaves = await prisma.salesleaves.findMany({ where: { salesmanId } })
        res.json({ success: true, leaves })
    } catch (error) {
        res.status(500).json({ success: false, error })

    }
}

export async function DenyLeaveReqSales(req: Request, res: Response) {
    const { id, actor } = req.body

    try {
        const update = await prisma.salesleaves.update({ where: { id }, data: { status: "denied", actor } })
        res.json({ success: true, update })

    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}


export async function ApproveLeaveReqSales(req: Request, res: Response) {
    const { id, actor } = req.body // actor is email of the HR approving the request

    try {
        const update = await prisma.salesleaves.update({ where: { id }, data: { status: "accepted", actor } })
        const leaveDayList = GetLeaveDayList(update.startDate, update.endDate)

        for (const leaveDay of leaveDayList) {
            await prisma.salesManAttendanceRecord.create(
                {
                    data:
                    {
                        salesmanId: update.salesmanId,
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



export async function getAllPendingLeavesSales(_: Request, res: Response) {
    try {
        const leaveRequests = await prisma.salesleaves.findMany()
        res.json({ success: true, leaveRequests })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}


export async function getLeavesBySalesManId(req: Request, res: Response) {
    const { salesmanId } = req.body
    try {
        const leaveRequests = await prisma.salesleaves.findMany({ where: { salesmanId } })
        res.json({ success: true, leaveRequests })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}


// TODO add paging
export async function getAllAttendanceRecordsSales(_: Request, res: Response) {
    try {
        const records = await prisma.salesManAttendanceRecord.findMany()
        res.json({ success: true, records })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

export async function getAllAttendanceRecordsBySalesMan(req: Request, res: Response) {
    const { salesmanId } = req.body
    try {
        const records = await prisma.salesManAttendanceRecord.findMany({ where: { salesmanId } })
        res.json({ success: true, records })
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, error })
    }
}

export async function getDateRangeRecordsSales(req: Request, res: Response) {
    const { salesmanId, startDate, endDate } = req.body
    try {
        const records = await prisma.salesManAttendanceRecord.findMany({
            where: {
                salesmanId, loginTime: {
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