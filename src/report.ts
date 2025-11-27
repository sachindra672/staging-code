import { Request, Response } from 'express'
import { prisma } from './misc'


export async function AdminReport(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body


    console.log(req.body)
    if (!bigCourseId || !endUsersId) {
        return res.status(400).json({ success: false, error: 'Missing sessionId or endUsersId', bigCourseId, endUsersId });
    }

    const bigCourseIdNumber = Number(bigCourseId);
    const endUsersIdNumber = Number(endUsersId);

    if (isNaN(bigCourseIdNumber) || bigCourseIdNumber <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid sessionId' });
    }

    if (isNaN(endUsersIdNumber) || endUsersIdNumber <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid endUsersId' });
    }


    try {
        const AttendenceRecords = await prisma.attendanceRecord.findMany({ where: { endUsersId, bigCourseId } })
        const sessionTestIds = (await prisma.session.findMany({
            where: { bigCourseId: bigCourseIdNumber },
            include: { SessionTest: { select: { id: true } } }
        })).map(e => e.SessionTest.map(f => f.id));

        if (!sessionTestIds) {
            return res.status(200).json({ success: true, submitted: false });
        }

        const SessionTestSubmissions: (({ sessionTestResponse: { id: number; createdOn: Date; response: number; sessionTestQuestionId: number; sessionTestId: number; endUsersId: number; sessionTestSubmissionId: number; }[]; } & { id: number; sessionTestId: number; endUsersId: number; }) | null)[] = []

        sessionTestIds.flat().flatMap(async (e) => {
            const submission = await prisma.sessionTestSubmission.findFirst({
                where: {
                    sessionTestId: e,
                    endUsersId: endUsersIdNumber
                },
                include: { sessionTestResponse: true }
            });
            SessionTestSubmissions.push(submission)
        })


        const ctestIds = (await prisma.ctest.findMany({ where: { bigCourseId }, select: { id: true } })).map(e => e.id)
        const myCtestSubmissions = await prisma.ctestSubmission.findMany({
            where: {
                endUsersId: endUsersId,
                ctestId: {
                    in: ctestIds
                }
            },
            include: {
                ctest: {
                    include: { ctestQuestions: true },
                },
                cTestResponse: true
            }
        });

        res.json({ success: true, AttendenceRecords, SessionTestSubmissions, myCtestSubmissions })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })

    }



}