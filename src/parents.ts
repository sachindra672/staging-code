import { prisma } from './misc'
import { Request, Response } from 'express'


export async function createParent(req: Request, res: Response) {
    const { name, phone } = req.body

    if (!name && !phone && typeof phone !== "string" || typeof name !== "string") {
        res.json({ success: false, message: "missing inputs" })
    }

    try {
        const parent = await prisma.parent.create({ data: { name, phone } })
        res.json({ success: true, parent })
    } catch (error) {
        res.json({ success: false, error })

    }
}

export async function setParent(req: Request, res: Response) {
    const { phone } = req.body

    try {
        const parent = await prisma.parent.findUnique({ where: { phone } })

        if (!parent) {
            res.json({
                success: false,
            })
        }
    } catch (error) {

    }
}

export async function setParentInfo(req: Request, res: Response) {
    const { endUsersId,   parentName           ,        parentDeviceIds        } = req.body

    try {
        const parent = await prisma.endUsers.update({ where: { id: endUsersId }, data:{} })

        if (!parent) {
            res.json({
                success: false,
            })
        }
    } catch (error) {

    }
}