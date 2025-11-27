import { Request, Response } from 'express'
import { uploadBanner2 } from './misc'
import path from 'path'
import fs from 'fs'

interface FileList {
    name: string,
    content: string
}
interface BannerBody {
    bigCourseId: number,
    fileList: FileList[]
}


export async function InsertCourseBanners(req: Request, res: Response) {
    try {
        const { fileList, bigCourseId }: BannerBody = req.body

        console.log(`course banner updating`);

        const ListExists = fs.existsSync(`../thumbs/banners/course_banners/${bigCourseId}`)

        if (ListExists) {
            console.log("existing images found, removing them")
            const ExistingBanners = fs.readdirSync(`../thumbs/banners/course_banners/${bigCourseId}`)
            for (const banner of ExistingBanners) {
                fs.unlink(`../thumbs/banners/course_banners/${bigCourseId}/${banner}`, (e) => { console.log('path/file.txt was deleted: ', e?.cause) })
            }
        }
        for (const file of fileList) {
            await uploadBanner2(file.content, file.name, `course_banners/${bigCourseId}`)
        }
        res.json({ success: true })
    } catch (error) {
        console.log(error)
        res.status(500).send("something went wrong")
    }
}

export async function getCourseBannerList(req: Request, res: Response) {

    try {
        const { bigCourseId } = req.body
        const materialDir = path.join(__dirname, `../thumbs/banners/course_banners/${bigCourseId}`);

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

export async function removeCourseBanner(req: Request, res: Response) {
    const { bigCourseId, FileName } = req.body
    try {
        const bannerDir = path.join(__dirname, `../thumbs/banners/course_banners/${bigCourseId}`);

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


