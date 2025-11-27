import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';

export async function updateTextFile(req: Request, res: Response) {
    try {
        const { filename, base64Content } = req.body;

        if (!filename || !base64Content) {
            return res.status(400).json({ error: 'Filename and base64 content are required' });
        }

        const filePath = path.join(__dirname, "../", 'thumbs', 'text', filename);

        await fs.writeFile(filePath, Buffer.from(base64Content, 'base64'));

        res.status(200).json({ message: 'File updated successfully' });
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ error: 'Failed to update file' });
    }
}
