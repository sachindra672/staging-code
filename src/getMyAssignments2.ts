import { Request, Response } from 'express';
import { prisma } from './misc';
import fs from 'fs';
import path from 'path';

async function getAssignmentsForCourse(courseId: number) {
    return await prisma.assignments.findMany({ where: { coursesId: courseId } });
}

function getFilesForAssignment(assignmentId: number) {
    const directoryPath = path.join(__dirname, '../assignments', `${assignmentId}`);
    let files: string[] = [];

    if (fs.existsSync(directoryPath)) {
        try {
            files = fs.readdirSync(directoryPath);
        } catch (error) {
            console.error(`Error reading directory for assignment ${assignmentId}:`, error);
        }
    }
    return files;
}

export async function GetUserAssignments2(req: Request, res: Response) {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).send("User ID is missing");
    }

    try {
        const purchases = await prisma.purchases.findMany({
            where: { endUsersId: userId },
            select: { coursesId: true }
        });

        const assignmentsWithFiles = [];

        for (const purchase of purchases) {
            const courseAssignments = await getAssignmentsForCourse(purchase.coursesId);

            for (const assignment of courseAssignments) {
                const files = getFilesForAssignment(assignment.id);
                assignmentsWithFiles.push({ ...assignment, files });
            }
        }

        return res.json(assignmentsWithFiles);
    } catch (error) {
        console.error('Error fetching user assignments:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
