import { Request, Response } from "express";
import fs from 'fs';
import path from 'path';

interface FileData {
    fileData: string;
    fileName: string;
}

function handleFileUpload(req: Request, res: Response, directoryName: string) {
    const { fileData, bigCourseId } = req.body;

    if (!fileData || !bigCourseId) {
        return res.status(400).send('Missing required fields');
    }

    const directoryPath = path.join(__dirname, directoryName);
    const assignmentDirectoryPath = path.join(directoryPath, bigCourseId);

    try {
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath);
        }

        if (!fs.existsSync(assignmentDirectoryPath)) {
            fs.mkdirSync(assignmentDirectoryPath);
        }

        const files: FileData[] = typeof fileData === 'string' ? JSON.parse(fileData) : fileData;

        for (const file of files) {
            const { fileName, fileData: base64Data } = file;
            const filePath = path.join(assignmentDirectoryPath, fileName);

            if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
                throw new Error(`Invalid file name: '${fileName}'`);
            }

            if (!base64Data || typeof base64Data !== 'string') {
                throw new Error(`Invalid file data for '${fileName}'`);
            }

            // Convert Buffer to Uint8Array for compatibility with fs.writeFileSync
            fs.writeFileSync(filePath, new Uint8Array(Buffer.from(base64Data, 'base64')));

        }

        res.status(200).send('Files uploaded successfully');
    } catch (error) {
        console.error('Error handling file upload:', error);

        if (error instanceof Error) {
            res.status(400).send(error.message);
        } else {
            res.status(500).send('Internal server error');
        }
    }
}

export function UploadAssignments(req: Request, res: Response) {
    handleFileUpload(req, res, '../assignments');
}

export function UploadCourseMaterials(req: Request, res: Response) {
    handleFileUpload(req, res, '../mg_mat');
}