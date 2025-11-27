import { Request, Response } from 'express'
import { prisma } from './misc'

export async function InsertOffer(req: Request, res: Response) {
    const { details, terms, sdate, edate, offerCode, targetCourse, maxSaving, isPercentage, discountQuantity } = req.body
    const start = new Date(sdate)
    const end = new Date(edate)
    try {
        const offer = await prisma.offer.create({
            data: {
                details,
                terms,
                start,
                end,
                offerCode,
                targetCourse,
                maxSaving,
                discountQuantity,
                isPercentage
            }
        })

        return res.json(offer)
    } catch (error) {
        console.log(error)
        res.status(500).send(error)
    }
}


export async function UpdateOffer(req: Request, res: Response) {
    const { id, details, terms, sdate, edate, offerCode } = req.body
    const start = new Date(sdate)
    const end = new Date(edate)
    const modifiedOn = new Date()

    try {
        const offer = await prisma.offer.update({
            where: {
                id
            },
            data: {
                details,
                terms,
                start,
                end,
                offerCode,
                modifiedOn
            }
        })

        return res.json(offer)
    } catch (error) {
        console.log(error)
        res.status(500).send(error)
    }
}

export async function GetOfferByCourse(req: Request, res: Response) {
    const { targetCourse } = req.body

    try {
        const offer = await prisma.offer.findMany({ where: { targetCourse } })
        res.json({ success: true, offer })
    } catch (error) {
        console.log(error)
        res.status(500).send({ success: false, error })
    }
}
