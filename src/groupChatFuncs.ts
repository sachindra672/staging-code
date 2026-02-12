import { prisma, uploadImage } from "./misc"
import { Request, Response } from "express"

export async function CreateGroup(req: Request, res: Response) {
    const { groupId, imageData, admins, students, groupName } = req.body
    try {
        const gc = await prisma.groupChatInfo.create({ data: { groupId, admins, students, groupName } })
        uploadImage(imageData, gc.id, "/group_icons")
        res.json({ success: true, gc })
    } catch (error) {
        res.json({ success: false, error })
    }
}

export async function UpdateGroup(req: Request, res: Response) {
    const { id, imageData, admins, students, groupName } = req.body
    try {
        const gc = await prisma.groupChatInfo.update({ where: { id }, data: { admins, students, groupName } })
        uploadImage(imageData, gc.id, "/group_icons")
        res.json({ success: true, gc })
    } catch (error) {
        res.json({ success: false, error })
    }
}

export async function GetMyGroups(req: Request, res: Response) {
    const { UUID } = req.body
    try {
        const gc = await prisma.groupChatInfo.findMany({
            where: {
                OR: [
                    {
                        students: {
                            has: UUID
                        }
                    },
                    {
                        admins: {
                            has: UUID
                        }
                    }
                ]
            }
        })
        res.json({ success: true, gc })
    } catch (error) {
        res.json({ success: false, error })
    }
}