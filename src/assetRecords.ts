import { prisma } from './misc';
import { Request, Response } from 'express';

// Helper function for input validation
function validateAssetRecordInput(input: any) {
    const { transactionType, sender, reciever, condition, assetId } = input;

    if (!transactionType || typeof transactionType !== 'string') return 'Invalid transaction type';
    if (!sender || typeof sender !== 'string') return 'Invalid sender';
    if (!reciever || typeof reciever !== 'string') return 'Invalid receiver';
    if (!condition || typeof condition !== 'string') return 'Invalid condition';
    if (!assetId || typeof assetId !== 'number') return 'Invalid asset ID';

    return null;
}

// Create a new asset record
export async function createAssetRecord(req: Request, res: Response) {
    try {
        const { transactionType, sender, reciever, condition, remark, assetId } = req.body;

        const validationError = validateAssetRecordInput(req.body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const assetExists = await prisma.asset.findUnique({
            where: { id: assetId },
        });

        if (!assetExists) {
            return res.status(404).json({ error: 'Asset not found' });
        }

        const newRecord = await prisma.assetRecords.create({
            data: {
                transactionType,
                sender,
                reciever,
                condition,
                remark,
                assetId,
            },
        });

        res.status(201).json(newRecord);
    } catch (error) {
        res.status(500).json({ error: 'Error creating asset record', details: error });
    }
}

// Get a single asset record by ID
export async function getAssetRecord(req: Request, res: Response) {
    const { id } = req.params;
    try {
        const record = await prisma.assetRecords.findUnique({
            where: { id: parseInt(id) },
        });

        if (!record) {
            return res.status(404).json({ error: 'Asset record not found' });
        }

        res.status(200).json(record);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching asset record' });
    }
}

// Update an asset record by ID
export async function updateAssetRecord(req: Request, res: Response) {
    const { id } = req.params;
    const { transactionType, sender, reciever, condition, remark, assetId } = req.body;

    try {
        const validationError = validateAssetRecordInput(req.body);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const existingRecord = await prisma.assetRecords.findUnique({
            where: { id: parseInt(id) },
        });

        if (!existingRecord) {
            return res.status(404).json({ error: 'Asset record not found' });
        }

        const updatedRecord = await prisma.assetRecords.update({
            where: { id: parseInt(id) },
            data: {
                transactionType,
                sender,
                reciever,
                condition,
                remark,
                assetId,
                updateOn: new Date(), // Update timestamp
            },
        });

        res.status(200).json(updatedRecord);
    } catch (error) {
        res.status(500).json({ error: 'Error updating asset record' });
    }
}

// Get all asset records
export async function getAllAssetRecords(_: Request, res: Response) {
    try {
        const records = await prisma.assetRecords.findMany();

        res.status(200).json(records);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching asset records' });
    }
}

// Get asset records by assetId
export async function getRecordsByAssetId(req: Request, res: Response) {
    const { assetId } = req.params;

    try {
        const records = await prisma.assetRecords.findMany({
            where: { assetId: parseInt(assetId) },
        });

        if (!records.length) {
            return res.status(404).json({ error: 'No records found for this asset' });
        }

        res.status(200).json(records);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching asset records for the asset' });
    }
}

// Get asset records by condition (custom route)
export async function getRecordsByCondition(req: Request, res: Response) {
    const { condition } = req.query;

    if (!condition || typeof condition !== 'string') {
        return res.status(400).json({ error: 'Invalid condition' });
    }

    try {
        const records = await prisma.assetRecords.findMany({
            where: { condition: condition as string },
        });

        if (!records.length) {
            return res.status(404).json({ error: 'No records found for this condition' });
        }

        res.status(200).json(records);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching asset records by condition' });
    }
}

// Get all records related to a specific asset
export async function getRecordsWithAssetDetails(_: Request, res: Response) {
    try {
        const records = await prisma.assetRecords.findMany({
            include: {
                asset: true, // Fetch asset details along with records
            },
        });

        res.status(200).json(records);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching records with asset details' });
    }
}
