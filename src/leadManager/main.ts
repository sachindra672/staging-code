import { Router, Request, Response } from "express";
import { parseCsvFromBase64, prisma, splitFieldData, uploadImage } from "../misc";

export const leadsRouter = Router()

async function InsertLeads(req: Request, res: Response) {
    const { courseId, fileData, grade } = req.body

    try {
        const FieldData = await parseCsvFromBase64(fileData)
        const salesmen = (await prisma.salesman.findMany({ select: { id: true }, where: { classes: { has: grade } } })).map(e => Number(e.id))

        const jobs = splitFieldData(FieldData, salesmen)

        for (const salesmanId in jobs) {
            if (Object.prototype.hasOwnProperty.call(jobs, salesmanId)) {
                const fieldDataArray = jobs[parseInt(salesmanId, 10)];
                console.log(`Salesman ID: ${salesmanId}`);
                for (const data of fieldDataArray) {
                    await prisma.leads2.create({
                        data: {
                            name: data.name,
                            email: data.email,
                            salesmanId: parseInt(salesmanId), // because js automatically converts int keys to string
                            phone: data.phone,
                            bigCourseId: courseId,
                            status: "pending",
                            city: data.city,
                            state: data.state,
                            misc: data.misc
                        }
                    });
                }
            }
        }
        res.status(200).json({ success: true })
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, error })
    }
}

export async function UpdateLead2(req: Request, res: Response) {
    const { id, name, email, phone, status, bigCourseId, imageData, misc } = req.body

    try {
        console.log(String(imageData).slice(0, 100))
        const updatedLead = await prisma.leads2.update({ where: { id }, data: { name, email, phone, status, bigCourseId, updatedOn: new Date(), misc } })
        uploadImage(imageData, updatedLead.id, "lead_images")
        res.status(201).json({ success: true, updatedLead })
    } catch (error) {
        res.status(500).json({ success: false, error })
    }
}

leadsRouter.post("/update", UpdateLead2)
leadsRouter.post("/bulk_insert", InsertLeads)

