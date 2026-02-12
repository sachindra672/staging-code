import { Request, Response } from "express";
import { generateAccessTokenUser, hashPassword, prisma, verifyPassword } from "./misc";

const phoneRegex = /^[0-9]{10}$/;

export async function InsertLead(req: Request, res: Response) {
    const { coursesId, salesmanId, leadInfo, targetPhone, status } = req.body;

    if (!coursesId || typeof coursesId !== 'number') {
        return res.status(400).json({ success: false, error: 'Invalid or missing coursesId' });
    }

    if (!salesmanId || typeof salesmanId !== 'number') {
        return res.status(400).json({ success: false, rror: 'Invalid or missing mentorId' });
    }

    if (!leadInfo || typeof leadInfo !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid or missing leadInfo' });
    }

    if (!targetPhone || typeof targetPhone !== 'string' || !phoneRegex.test(targetPhone)) {
        return res.status(400).json({ error: 'Invalid or missing targetPhone. It should be a 10-digit number.' });
    }

    try {
        const lead = await prisma.leads.create({
            data: {
                coursesId,
                salesmanId,
                leadInfo,
                targetPhone,
                status
            }
        })

        return res.status(201).json({ success: true, lead })
    } catch (error) {
        console.log(error)
        return res.status(500).send({ success: false, error })
    }
}

export async function UpdateLead(req: Request, res: Response) {
    const { id, coursesId, salesmanId, leadInfo, targetPhone, status } = req.body;

    if (!coursesId || typeof coursesId !== 'number') {
        return res.status(400).json({ success: false, error: 'Invalid or missing coursesId' });
    }

    if (!salesmanId || typeof salesmanId !== 'number') {
        return res.status(400).json({ success: false, error: 'Invalid or missing mentorId' });
    }

    if (!leadInfo || typeof leadInfo !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid or missing leadInfo' });
    }

    if (!targetPhone || typeof targetPhone !== 'string' || !phoneRegex.test(targetPhone)) {
        return res.status(400).json({ success: false, error: 'Invalid or missing targetPhone. It should be a 10-digit number.' });
    }

    try {
        const lead = await prisma.leads.update({
            where: {
                id
            },
            data: {
                coursesId,
                salesmanId,
                leadInfo,
                targetPhone,
                status
            }
        })

        return res.status(201).json({ success: true, lead })
    } catch (error) {
        console.log(error)
        return res.status(500).send({ success: false, error })
    }
}

export async function InsertSalesman(req: Request, res: Response) {
    const { name, email, password, classes } = req.body

    try {
        const passwordHash = await hashPassword(password)
        const lead = await prisma.salesman.create({
            data: {
                name,
                email,
                passwordHash,
                classes,
            }
        })

        return res.status(201).json({ success: true, lead })
    } catch (error) {
        console.log(error)
        return res.status(500).send({ success: false, error })
    }
}

export async function UpdateSalesman(req: Request, res: Response) {
    const { id, name, email, password, classes, isActive } = req.body

    try {
        const passwordHash = await hashPassword(password)
        const lead = await prisma.salesman.update({
            where: { id },
            data: {
                name,
                email,
                classes,
                passwordHash,
                isActive
            }
        })
        return res.status(201).json({ success: true, lead })
    } catch (error) {
        return res.status(500).send({ success: false, error })
    }

}

export async function ListAllLeads(_: Request, res: Response) {
    try {
        const lead = await prisma.leads2.findMany()
        return res.status(201).json({ success: true, lead })
    } catch (error) {
        console.log(error)
        return res.status(500).send({ success: false, error })
    }
}

export async function LoginSalesMan(req: Request, res: Response) {
    const { email, password } = req.body

    if (!email || !password) {
        console.log(req.body)
        res.json({ success: false, message: "missing fields" })
        return
    }
    try {
        const salesman = await prisma.salesman.findFirstOrThrow({ where: { email } });

        if (!salesman) {
            res.json({ success: false, message: "account not found" })
            return
        }

        const isPasswordValid = await verifyPassword(password, salesman.passwordHash);
        if (!isPasswordValid) {
            return res.json({ success: false, message: "invalid credentials" });
        }

        const token = generateAccessTokenUser(salesman);
        return res.json({ success: true, token, salesman });
    } catch (error) {
        console.log(error)
        return res.status(500).send({ success: false, error })
    }
}

export async function MyLeads(req: Request, res: Response) {
    const { salesmanId } = req.body

    try {
        const leads = await prisma.leads2.findMany({ where: { salesmanId } })
        res.json({ success: true, leads })
    } catch (error) {
        console.log(error)
        return res.status(500).send({ success: false, error })
    }
}

export async function DeleteLead(req: Request, res: Response) {
    const { id } = req.body

    try {
        const deletedLead = await prisma.leads.delete({ where: { id } })
        res.json({ success: true, deletedLead })
    } catch (error) {
        console.log(error)
        return res.status(500).send({ success: false, error })
    }
}

export async function ListSalesmen(_: Request, res: Response) {
    try {
        const salesmen = await prisma.salesman.findMany()
        res.json({ success: true, salesmen })
    } catch (error) {
        console.log(error)
        return res.status(500).send({ success: false, error })
    }
}