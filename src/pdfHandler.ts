import { Request, Response } from 'express';
import { addWatermarkAndCompress } from './utils/pdf';

export const pdfHandler = async (req: Request, res: Response) => {
    try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const pdfFile = files?.pdf?.[0];
        const wmFile = files?.watermark?.[0];

        if (!pdfFile || !wmFile) {
            return res.status(400).send("PDF and watermark image are required");
        }

        const outputPath = `output/${Date.now()}-processed.pdf`;
        await addWatermarkAndCompress(pdfFile.path, outputPath, wmFile.path);

        res.download(outputPath);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error processing PDF");
    }
}