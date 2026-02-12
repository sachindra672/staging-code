import { Request, Response } from 'express'
import { prisma, uploadBanner, uploadBanner2 } from './misc'
import path from 'path'
import fs from 'fs'

interface FileList {
    name: string,
    content: string
}
interface BannerBody {
    offerId: number,
    fileList: FileList[]
}
export async function InsertBanner(req: Request, res: Response) {
    try {
        const { offerId, fileList }: BannerBody = req.body
        const banner = await prisma.banner.create({ data: { offerId } })
        for (const file of fileList) {
            uploadBanner(file.content, file.name, banner.id)
        }
        res.json(banner)
    } catch (error) {
        console.log(error)
        res.status(500).send("something went wrong")
    }
}

export async function InsertFreeBanner(req: Request, res: Response) {
    try {
        const { fileList }: BannerBody = req.body
        for (const file of fileList) {
            uploadBanner2(file.content, file.name, "all_banners")
        }
        res.json({ success: true })
    } catch (error) {
        console.log(error)
        res.status(500).send("something went wrong")
    }
}

export async function getFreeBannerList(_: Request, res: Response) {

    try {
        const materialDir = path.join(__dirname, `../thumbs/banners/all_banners`);

        if (!fs.existsSync(materialDir)) {
            return res.status(404).json({ success: false, error: 'banners not found or no files uploaded in ', materialDir });
        }
        const files = fs.readdirSync(materialDir);
        res.status(200).json({ success: true, files });
    } catch (error) {
        console.error('Error in getDoubtFiles:', error);
        res.status(500).json({ success: false, error: 'Internal server error', message: error });
    }
}

export async function removeBanner(req: Request, res: Response) {
    const { FileName } = req.body
    try {
        const bannerDir = path.join(__dirname, `../thumbs/banners/all_banners/`);

        if (!fs.existsSync(bannerDir)) {
            return res.status(404).json({ success: false, error: 'banners not found or no files uploaded in ', materialDir: bannerDir });
        }
        const FinalBannerFilePath = path.join(bannerDir, FileName)
        console.log(path.join(FinalBannerFilePath))
        const files = fs.unlinkSync(path.join(bannerDir, FileName));
        res.status(200).json({ success: true, files });
    } catch (error) {
        console.error('Error in getDoubtFiles:', error);
        res.status(500).json({ success: false, error: 'Internal server error', message: error, });
    }
}

export async function UpdateBanner(req: Request, res: Response) {
    const { id, offerId } = req.body
    const modifiedOn = new Date()
    try {
        const banner = await prisma.banner.update({
            where: { id },
            data: { offerId, modifiedOn, }
        })
        res.json(banner)
    } catch (error) { res.status(500).send("something went wrong") }
}

