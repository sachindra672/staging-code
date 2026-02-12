import fs from "fs";
import path from "path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { execFile } from "child_process";

/**
 * Compress a PDF using Ghostscript CLI (async)
 */
const compressPDF = (
    inputPath: string,
    outputPath: string,
    quality: "screen" | "ebook" | "printer" | "prepress" = "ebook"
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const args = [
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            `-dPDFSETTINGS=/${quality}`,
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            `-sOutputFile=${outputPath}`,
            inputPath,
        ];

        // Increase maxBuffer to handle large files (~500MB)
        execFile("gs", args, { maxBuffer: 1024 * 1024 * 500 }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
};

/**
 * Add watermark to PDF and compress
 */
export const addWatermarkAndCompress = async (
    inputPath: string,
    outputPath: string,
    watermarkPath: string,
    quality: "screen" | "ebook" | "printer" | "prepress" = "ebook"
) => {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });

    // 1️⃣ Load PDF into memory
    const existingPdfBytes = await fs.promises.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(new Uint8Array(existingPdfBytes));

    // 2️⃣ Prepare watermark image
    const watermarkBuffer = await sharp(watermarkPath).resize(200).png().toBuffer();
    const watermarkImage = await pdfDoc.embedPng(new Uint8Array(watermarkBuffer));

    // 3️⃣ Add watermark to every page
    for (const page of pdfDoc.getPages()) {
        const { width, height } = page.getSize();
        const wmWidth = 200;
        const wmHeight = (watermarkImage.height / watermarkImage.width) * wmWidth;

        page.drawImage(watermarkImage, {
            x: width / 2 - wmWidth / 2,
            y: height / 2 - wmHeight / 2,
            width: wmWidth,
            height: wmHeight,
            opacity: 0.4,
        });
    }

    // 4️⃣ Save temporary watermarked PDF
    const tempPath = path.join(dir, "temp_watermarked.pdf");
    await fs.promises.writeFile(tempPath, await pdfDoc.save());

    try {
        // 5️⃣ Compress PDF using Ghostscript CLI
        await compressPDF(tempPath, outputPath, quality);
    } finally {
        // 6️⃣ Clean up temp file even if compression fails
        if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
    }
};
