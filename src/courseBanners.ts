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


// export async function InsertCourseBanners(req: Request, res: Response) {
//     try {
//         const { fileList, bigCourseId }: BannerBody = req.body

//         if (!bigCourseId) {
//             return res.status(400).json({ success: false, error: 'bigCourseId is required' });
//         }

//         // PRESERVE MODE: If fileList is empty/missing, preserve existing banners
//         if (!fileList || !Array.isArray(fileList) || fileList.length === 0) {
//             console.log(`[InsertCourseBanners] Preserve mode: No fileList provided, preserving existing banners for course ${bigCourseId}`);

//             const bannerDir = path.join(__dirname, `../thumbs/banners/course_banners/${bigCourseId}`);
//             const existingBanners = fs.existsSync(bannerDir) ? fs.readdirSync(bannerDir) : [];

//             return res.json({
//                 success: true,
//                 message: 'Banners preserved (no changes requested)',
//                 preserved: existingBanners.length,
//                 existingBanners: existingBanners
//             });
//         }

//         // UPDATE MODE: Validate each file has valid content
//         const validFiles = fileList.filter(file =>
//             file &&
//             file.name &&
//             typeof file.name === 'string' &&
//             file.content &&
//             typeof file.content === 'string' &&
//             file.content.trim() !== ''
//         );

//         if (validFiles.length === 0) {
//             return res.status(400).json({ success: false, error: 'No valid files found in fileList. Each file must have name and content.' });
//         }

//         // UPDATE MODE: Replace existing banners with new ones
//         console.log(`[InsertCourseBanners] Update mode: Replacing course banners for course ${bigCourseId}, ${validFiles.length} files to upload`);

//         // Only delete existing banners if we have valid files to upload
//         const bannerDir = path.join(__dirname, `../thumbs/banners/course_banners/${bigCourseId}`);

//         if (fs.existsSync(bannerDir)) {
//             console.log("[InsertCourseBanners] Existing banners found, removing them before uploading new ones");
//             const existingBanners = fs.readdirSync(bannerDir);
//             for (const banner of existingBanners) {
//                 const bannerPath = path.join(bannerDir, banner);
//                 try {
//                     fs.unlinkSync(bannerPath);
//                     console.log(`[InsertCourseBanners] Deleted existing banner: ${banner}`);
//                 } catch (error) {
//                     console.error(`[InsertCourseBanners] Error deleting banner ${banner}:`, error);
//                 }
//             }
//         }

//         // Upload new banners with error handling
//         const uploadResults: { success: boolean; fileName: string; error?: string }[] = [];

//         for (const file of validFiles) {
//             try {
//                 await uploadBanner2(file.content, file.name, `course_banners/${bigCourseId}`);
//                 console.log(`[InsertCourseBanners] Successfully uploaded banner: ${file.name}`);
//                 uploadResults.push({ success: true, fileName: file.name });
//             } catch (error) {
//                 const errorMessage = error instanceof Error ? error.message : String(error);
//                 console.error(`[InsertCourseBanners] Failed to upload banner ${file.name}:`, errorMessage);
//                 uploadResults.push({
//                     success: false,
//                     fileName: file.name,
//                     error: errorMessage
//                 });
//             }
//         }

//         const successfulUploads = uploadResults.filter(r => r.success).length;
//         const failedUploads = uploadResults.filter(r => !r.success);

//         if (failedUploads.length === 0) {
//             // All uploads succeeded
//             res.json({
//                 success: true,
//                 message: `Successfully uploaded ${successfulUploads} banner(s)`,
//                 uploaded: successfulUploads
//             });
//         } else if (successfulUploads === 0) {
//             // All uploads failed
//             res.status(400).json({
//                 success: false,
//                 error: 'All banner uploads failed',
//                 failures: failedUploads,
//                 uploaded: 0
//             });
//         } else {
//             // Partial success - some succeeded, some failed
//             res.status(207).json({
//                 success: true,
//                 message: `Partially successful: ${successfulUploads} uploaded, ${failedUploads.length} failed`,
//                 uploaded: successfulUploads,
//                 failures: failedUploads
//             });
//         }
//     } catch (error) {
//         console.error('[InsertCourseBanners] Error:', error);
//         res.status(500).json({ success: false, error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' });
//     }
// }

export async function InsertCourseBanners(req: Request, res: Response) {
    try {
        const { fileList, bigCourseId }: BannerBody = req.body;

        if (!bigCourseId) {
            return res
                .status(400)
                .json({ success: false, error: 'bigCourseId is required' });
        }

        const bannerDir = path.join(
            __dirname,
            `../thumbs/banners/course_banners/${bigCourseId}`,
        );

        // Strip "data:image/...;base64," if present
        const normalizeBase64 = (data: string): string => {
            const trimmed = data.trim();
            if (trimmed.startsWith('data:')) {
                const commaIndex = trimmed.indexOf(',');
                return commaIndex !== -1 ? trimmed.slice(commaIndex + 1) : trimmed;
            }
            return trimmed;
        };

        // PRESERVE MODE: no fileList at all → do nothing
        if (!fileList || !Array.isArray(fileList) || fileList.length === 0) {
            console.log(
                `[InsertCourseBanners] Preserve mode: No fileList provided, preserving existing banners for course ${bigCourseId}`,
            );
            const existingBanners = fs.existsSync(bannerDir)
                ? fs.readdirSync(bannerDir)
                : [];
            return res.json({
                success: true,
                message: 'Banners preserved (no changes requested)',
                preserved: existingBanners.length,
                existingBanners,
            });
        }

        // Split into:
        // - serverFiles: existing images already on disk (content is URL, serverImage: true)
        // - newFiles: images we actually need to upload (content is base64 / data URL)
        const serverFiles = fileList.filter(
            (file: any) => file && file.serverImage === true,
        );
        const newFiles = fileList.filter(
            (file: any) => !file || file.serverImage !== true,
        );

        // If there are no new files, just preserve existing banners
        if (!newFiles || newFiles.length === 0) {
            console.log(
                `[InsertCourseBanners] Only serverImage entries, no new uploads. Preserving existing banners for course ${bigCourseId}`,
            );
            const existingBanners = fs.existsSync(bannerDir)
                ? fs.readdirSync(bannerDir)
                : [];
            return res.json({
                success: true,
                message: 'No new banners to upload; existing banners preserved',
                preserved: existingBanners.length,
                existingBanners,
            });
        }

        // Validate NEW files
        const validFiles = newFiles.filter(
            (file: any) =>
                file &&
                file.name &&
                typeof file.name === 'string' &&
                file.content &&
                typeof file.content === 'string' &&
                file.content.trim() !== '',
        );

        if (validFiles.length === 0) {
            return res.status(400).json({
                success: false,
                error:
                    'No valid files found in fileList. Each new file must have name and content.',
            });
        }

        // Names of server files to KEEP (not delete)
        const keepNames = new Set<string>(
            serverFiles
                .filter(
                    (file: any) => file && file.name && typeof file.name === 'string',
                )
                .map((file: any) => file.name as string),
        );

        console.log(
            `[InsertCourseBanners] Update mode: ${validFiles.length} new file(s) to upload; ${keepNames.size} existing file(s) to keep for course ${bigCourseId}`,
        );

        // Delete existing banners that are NOT in keepNames
        if (fs.existsSync(bannerDir)) {
            console.log(
                '[InsertCourseBanners] Existing banners found, cleaning up before uploading new ones',
            );
            const existingBanners = fs.readdirSync(bannerDir);
            for (const banner of existingBanners) {
                if (!keepNames.has(banner)) {
                    const bannerPath = path.join(bannerDir, banner);
                    try {
                        fs.unlinkSync(bannerPath);
                        console.log(
                            `[InsertCourseBanners] Deleted existing banner: ${banner}`,
                        );
                    } catch (error) {
                        console.error(
                            `[InsertCourseBanners] Error deleting banner ${banner}:`,
                            error,
                        );
                    }
                } else {
                    console.log(
                        `[InsertCourseBanners] Preserving existing banner: ${banner}`,
                    );
                }
            }
        }

        // Upload only NEW banners (base64 / data URL)
        const uploadResults: {
            success: boolean;
            fileName: string;
            error?: string;
        }[] = [];

        for (const file of validFiles) {
            try {
                const base64 = normalizeBase64(file.content);
                await uploadBanner2(base64, file.name, `course_banners/${bigCourseId}`);
                console.log(
                    `[InsertCourseBanners] Successfully uploaded banner: ${file.name}`,
                );
                uploadResults.push({ success: true, fileName: file.name });
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                console.error(
                    `[InsertCourseBanners] Failed to upload banner ${file.name}:`,
                    errorMessage,
                );
                uploadResults.push({
                    success: false,
                    fileName: file.name,
                    error: errorMessage,
                });
            }
        }

        const successfulUploads = uploadResults.filter((r) => r.success).length;
        const failedUploads = uploadResults.filter((r) => !r.success);

        if (failedUploads.length === 0) {
            res.json({
                success: true,
                message: `Successfully uploaded ${successfulUploads} banner(s)`,
                uploaded: successfulUploads,
            });
        } else if (successfulUploads === 0) {
            res.status(400).json({
                success: false,
                error: 'All banner uploads failed',
                failures: failedUploads,
                uploaded: 0,
            });
        } else {
            res.status(207).json({
                success: true,
                message: `Partially successful: ${successfulUploads} uploaded, ${failedUploads.length} failed`,
                uploaded: successfulUploads,
                failures: failedUploads,
            });
        }
    } catch (error) {
        console.error('[InsertCourseBanners] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
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


