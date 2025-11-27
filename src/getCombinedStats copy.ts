import { Request, Response } from 'express';

export async function GetCombinedStats(req: Request, res: Response) {
    const { endUsersId, bigCourseId } = req.body;
    const authHeader = req.headers.authorization;

    try {
        const [ctestStats, attendanceStats, sessionTestStats, attendanceWithInterval] = await Promise.all([
            fetch("http://localhost:4000/get_my_big_course_ctest_submissions", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(authHeader ? { Authorization: authHeader } : {}), },
                body: JSON.stringify({ endUsersId, bigCourseId })
            }).then((e: { json: () => any; }) => e.json()),

            fetch("http://localhost:4000/get_my_attendance_progress_report", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(authHeader ? { Authorization: authHeader } : {}), },
                body: JSON.stringify({ endUsersId, bigCourseId })
            }).then(e => e.json()),

            fetch("http://localhost:4000/get_my_bigCourse_session_test_submissions", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(authHeader ? { Authorization: authHeader } : {}), },
                body: JSON.stringify({ endUsersId, bigCourseId })
            }).then(e => e.json()),

            fetch("http://localhost:4000/get_attendance_detail", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(authHeader ? { Authorization: authHeader } : {}), },
                body: JSON.stringify({ studentId: endUsersId, courseId: bigCourseId })
            }).then(e => e.json())
        ]);

        res.json({ success: true, data: { ctestStats, attendanceStats, sessionTestStats, attendanceWithInterval } });
    } catch (error) {
        console.error("Error fetching combined stats:", error); // Log the error for debugging
        res.status(500).json({ success: false, error: 'Failed to fetch combined stats' });
    }
}
