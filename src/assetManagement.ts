import { prisma } from './misc';
import { Request, Response } from 'express';

export async function createAsset(req: Request, res: Response) {
    try {
        const { purchaseDate, BookValue, assetName, assetType, assetSerial, assetStatus } = req.body;

        const newAsset = await prisma.asset.create({
            data: {
                purchaseDate: new Date(purchaseDate),
                BookValue,
                assetName,
                assetType,
                assetSerial,
                assetStatus,
            },
        });

        res.status(201).json({ success: true, newAsset });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error creating asset' });
    }
}

export async function getAsset(req: Request, res: Response) {
    const { id } = req.params;
    try {
        const asset = await prisma.asset.findUnique({
            where: { id: parseInt(id) },
        });

        if (!asset) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        res.status(200).json({ success: true, asset });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error fetching asset' });
    }
}

export async function updateAsset(req: Request, res: Response) {
    const { id } = req.params;
    const { purchaseDate, BookValue, assetName, assetType, assetSerial, assetStatus } = req.body;

    try {
        const updatedAsset = await prisma.asset.update({
            where: { id: parseInt(id) },
            data: {
                purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
                BookValue,
                assetName,
                assetType,
                assetSerial,
                assetStatus,
                updateOn: new Date(),
            },
        });

        res.status(200).json({ success: true, updatedAsset });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error updating asset' });
    }
}

export async function deleteAsset(req: Request, res: Response) {
    const { id } = req.params;

    try {
        await prisma.asset.delete({
            where: { id: parseInt(id) },
        });

        res.send({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error deleting asset' });
    }
}

export async function getAllAssets(_: Request, res: Response) {
    try {
        const assets = await prisma.asset.findMany();

        res.status(200).json({ success: true, assets });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error fetching assets' });
    }
}
