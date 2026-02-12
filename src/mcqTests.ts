import { Request, Response } from 'express';
import { prisma } from './misc';

export async function createMcqTest(req: Request, res: Response): Promise<void> {
    try {
        const { startTime, endTime, createdBy, createdFor, mcq } = req.body;

        const missingFields = [];
        if (!startTime) missingFields.push("startTime");
        if (!endTime) missingFields.push("endTime");
        if (!createdBy) missingFields.push("createdBy");
        if (!createdFor) missingFields.push("createdFor");
        if (!mcq) missingFields.push("mcq");

        if (missingFields.length > 0) {
            res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
            return;
        }

        const parsedStartTime = new Date(startTime);
        const parsedEndTime = new Date(endTime);

        const data = {
            startTime: parsedStartTime,
            endTime: parsedEndTime,
            createdBy: { connect: { id: createdBy } },
            createdFor: { connect: { id: createdFor } },
            mcq: { createMany: { data: mcq } }
        };

        const newMcqTest = await prisma.mcqTest.create({ data });
        console.log("MCQ Test created:", newMcqTest);

        res.status(201).json(newMcqTest);
    } catch (error) {
        console.error("Error creating MCQ Test:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}


// sample json for above route
/* 
{
  "startTime": "2024-06-20T10:00:00",  // Replace with your start time string
  "endTime": "2024-06-20T11:00:00",  // Replace with your end time string (optional)
  "createdBy": 1,                   // Replace with mentor ID
  "createdFor": 2,                   // Replace with course ID
  "mcq": [
    {
      "option1": "A scripting language",
      "option2": "B...",
      "option3": "C...",              // Include all options even if empty
      "option4": "D...",              // Include all options even if empty
      "answer": 1                       // Replace with the correct option number (1-based)
    },
    {
      "option1": "A markup language",
      "option2": "B...",
      "option3": "C...",              // Include all options even if empty
      "option4": "D...",              // Include all options even if empty
      "answer": 1                       // Replace with the correct option number (1-based)
    },
    // Add more mcq objects here
  ]
}
*/

export async function updateMcqTest(req: Request, res: Response): Promise<void> {
    try {
        const { id, startTime, endTime } = req.body;

        if (!id) {
            res.status(400).json({ error: "ID is required" });
            return;
        }

        const updateData: any = {};
        if (startTime) updateData.startTime = new Date(startTime);
        if (endTime) updateData.endTime = new Date(endTime);

        if (Object.keys(updateData).length === 0) {
            res.status(400).json({ error: "No fields provided to update" });
            return;
        }

        const updatedMcqTest = await prisma.mcqTest.update({
            where: { id },
            data: updateData,
        });

        console.log("MCQ Test updated:", updatedMcqTest);

        res.status(200).json(updatedMcqTest);
    } catch (error) {
        console.error("Error updating MCQ Test:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

// sample update json
/*
{
    "id": "1234",
    "startTime": "2024-06-20T10:00:00.000Z",
    "endTime": "2024-06-20T12:00:00.000Z"
}
*/


export async function updateMcq(req: Request, res: Response) {
    try {
        const { id, option1, option2, option3, option4, answer } = req.body;

        if (!id) {
            return res.status(400).json({ error: "ID is required" });
        }

        // Collect fields to update
        const updateData: { [key: string]: any } = {};
        if (option1 !== undefined) updateData.option1 = option1;
        if (option2 !== undefined) updateData.option2 = option2;
        if (option3 !== undefined) updateData.option3 = option3;
        if (option4 !== undefined) updateData.option4 = option4;
        if (answer !== undefined) updateData.answer = answer;

        // Update the MCQ
        const updatedMcq = await prisma.mcq.update({
            where: { id: parseInt(id, 10) },
            data: updateData,
        });

        console.log("MCQ updated:", updatedMcq);

        return res.status(200).json(updatedMcq);
    } catch (error) {
        console.error("Error updating MCQ:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

/*

sample json

{
    "id": "1234",
    "option1": "New Option 1",
    "option2": "New Option 2",
    "option3": "New Option 3",
    "option4": "New Option 4",
    "answer": 2
}

*/

export async function insertMcq(req: Request, res: Response) {
    try {
        const { option1, option2, option3, option4, answer, mcqTestId } = req.body;

        // Validate required fields
        const missingFields = [];
        if (!option1) missingFields.push("option1");
        if (!option2) missingFields.push("option2");
        if (!option3) missingFields.push("option3");
        if (!option4) missingFields.push("option4");
        if (answer === undefined) missingFields.push("answer");
        if (mcqTestId === undefined) missingFields.push("mcqTestId");

        if (missingFields.length > 0) {
            return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
        }

        // Check if the associated test ID exists
        const testExists = await prisma.mcqTest.findUnique({
            where: { id: mcqTestId },
        });

        if (!testExists) {
            return res.status(400).json({ error: "Invalid mcqTestId, test not found" });
        }

        const newMcq = await prisma.mcq.create({
            data: {
                option1,
                option2,
                option3,
                option4,
                answer,
                mcqTestId,
            },
        });

        console.log("New MCQ inserted:", newMcq);

        return res.status(201).json(newMcq);
    } catch (error) {
        console.error("Error inserting MCQ:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
//sample json  
/*
{
    "option1": "Option A",
    "option2": "Option B",
    "option3": "Option C",
    "option4": "Option D",
    "answer": 2,
    "mcqTestId": 1
}
*/

export async function GetTestByCourseId(req: Request, res: Response) {
    const { coursesId } = req.body

    try {
        const mcqTest = await prisma.mcqTest.findMany({
            where: { coursesId },
            include: { createdFor: { select: { name: true } }, mcq: true }
        })
        res.json({ success: true, mcqTest })
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
}