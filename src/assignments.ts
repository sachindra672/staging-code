import { Request, Response } from 'express'
import fs from 'fs';
import path from 'path';
import { prisma } from "./misc"

export async function InsertAssignmentWithFiles(req: Request, res: Response) {
    const { mentorId, name, subject, coursesId, deadLine, files } = req.body;

    const missingFields = [];
    if (!mentorId) missingFields.push('mentorId');
    if (!name) missingFields.push('name');
    if (!subject) missingFields.push('subject');
    if (!coursesId) missingFields.push('coursesId');
    if (!deadLine) missingFields.push('deadLine');
    if (!files) missingFields.push('files');

    if (missingFields.length > 0) {
        return res.status(400).json({ success: false, missingFields });
    }

    try {
        // Create the assignment entry in the database
        const course = await prisma.assignments.create({
            data: {
                mentorId,
                name,
                subject,
                coursesId,
                deadLine
            }
        });

        // Define the directory paths
        const assignmentId = course.id.toString(); // Assuming course.id is the unique identifier for the assignment
        const assignmentsDir = path.join(__dirname, "../", 'assignments');
        const IdassignmentDir = path.join(assignmentsDir, assignmentId);

        // Ensure the assignments directory exists
        if (!fs.existsSync(assignmentsDir)) {
            fs.mkdirSync(assignmentsDir);
        }

        // Ensure the assignment-specific directory exists
        if (!fs.existsSync(IdassignmentDir)) {
            fs.mkdirSync(IdassignmentDir);
        }

        // Iterate over the files and write them to the filesystem
        files.forEach((file: { name: string; content: string; }) => {
            const { name, content } = file;
            const filePath = path.join(IdassignmentDir, name);
            const fileBuffer = Buffer.from(content, 'base64');

            fs.writeFileSync(filePath, fileBuffer);
        });

        res.status(200).json({ success: true, course });
    } catch (error) {
        console.error('Error handling file upload:', error);
        res.status(500).json({ success: false, cause: error });
    }
}


export async function InsertAssignment(req: Request, res: Response) {
    const { mentorId, name, subject, parentCourse, coursesId, deadLine } = req.body
    try {
        const course = await prisma.assignments.create({
            data: {
                mentorId,
                name,
                parentCourse,
                subject,
                coursesId,
                deadLine
            } as any,
        })

        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export async function UpdateAssignment(req: Request, res: Response) {
    const { id, name, subject, parentCourse, coursesId, deadLine } = req.body
    try {
        const course = await prisma.assignments.update({
            where: {
                id
            },
            data: {
                name,
                parentCourse,
                subject,
                coursesId,
                deadLine
            } as any,
        })

        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export async function InsertSubmission(req: Request, res: Response) {
    const { assignmentsId, endUsersId, coursesId } = req.body
    try {
        const course = prisma.submission.create({
            data: {
                assignmentsId,
                endUsersId,
                coursesId,
            }
        })
        res.json(course)
    } catch (error) {
        res.json({ success: false, cause: error })
    }
}

export const sampleSubWithFile = {
    "assignmentsId": "1",
    "endUsersId": "2",
    "coursesId": "3",
    "files": [
        {
            "name": "file1.txt",
            "content": "base64encodedcontent"
        },
        {
            "name": "file2.txt",
            "content": "base64encodedcontent"
        }
    ]
}

export async function InsertSubmissionWithFiles(req: Request, res: Response) {
    const { assignmentsId, endUsersId, coursesId, files } = req.body;
    const missingFields = [];
    if (!assignmentsId) missingFields.push('assignmentsId');
    if (!endUsersId) missingFields.push('endUsersId');
    if (!coursesId) missingFields.push('coursesId');
    if (!Array.isArray(files) || files.length === 0) missingFields.push('files');

    if (missingFields.length > 0) { return res.status(400).json({ success: false, missingFields }) }

    try {
        const submission = await prisma.submission.create({
            data: {
                assignmentsId,
                endUsersId,
                coursesId,
            }
        });

        const submissionId = submission.id.toString();
        const submissionsDir = path.join(__dirname, "../", 'submissions', submissionId);


        await fs.promises.mkdir(submissionsDir, { recursive: true });

        for (const file of files) {
            const { name, content } = file;
            const filePath = path.join(submissionsDir, name);
            const fileBuffer = Buffer.from(content, 'base64');

            await fs.promises.writeFile(filePath, fileBuffer);
        }

        res.status(200).json({ success: true, submission });
    } catch (error) {
        console.error('Error handling file upload:', error);
        res.status(500).json({ success: false, cause: error });
    }
}

export async function GetUserAssingments(req: Request, res: Response) {
    const { userId } = req.body
    if (!userId) {
        return res.status(400).send("user id missing")
    }
    try {
        const purchases = await prisma.purchases.findMany({ where: { endUsersId: userId }, select: { coursesId: true } })
        const assigments = []

        console.log("looping over purchases")
        for (let index = 0; index < purchases.length; index++) {
            const purchase = purchases[index];
            const courseAssigments = await prisma.assignments.findMany({ where: { coursesId: purchase.coursesId } })
            assigments.push(...courseAssigments)
        }
        return res.json(assigments)
    } catch (error) {  
        console.error('Error handling file upload:', error);
        res.status(500).json({ success: false, cause: error });
     }
}


export async function GetFileList(req: Request, res: Response) {
    const { assignmentId } = req.body;

    const directoryPath = path.join(__dirname, 'assignments', assignmentId);

    try {
        if (!fs.existsSync(directoryPath)) {
            return res.status(404).json({ message: 'Directory not found' });
        }

        fs.readdir(directoryPath, (err, files) => {
            if (err) {
                return res.status(500).json({ message: 'Error reading directory' });
            }
            res.status(200).json({ files });
        });
    } catch (error) {
        console.error('Error handling file upload:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

export async function GetTeacherAssignments(req: Request, res: Response) {
    const { mentorId } = req.body

    if (!mentorId) return res.status(401).send("mentor id missing")

    try {
        const assigments = await prisma.assignments.findMany({ where: { mentorId } })
        res.json(assigments)
    } catch (error) {
        res.json({ succes: false, error })
    }
}
export async function GetMySubmissions(req: Request, res: Response) {
    const { endUsersId } = req.body

    try {
        const submissions = await prisma.submission.findMany({ where: { endUsersId } })
        res.json({ success: true, submissions })
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }

}
