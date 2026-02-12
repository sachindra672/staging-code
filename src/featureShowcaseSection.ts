import { prisma } from './misc'
import { Request, Response } from 'express'
import { uploadImageToGCS } from "./utils/gcsUpload";

export const getAllFeatureShowcaseSection = async (_req: Request, res: Response) => {
    try {
        const sections = await prisma.featureShowcaseSection.findMany({
            where: { isActive: true },
            include: { features: true, images: true },
            orderBy: { order: 'asc' },
        });

        return res.status(200).json(sections);
    } catch (error: unknown) {
        console.error('Error fetching feature sections:', error);

        const message =
            error instanceof Error ? error.message : 'An unexpected error occurred';

        return res.status(500).json({ error: message });
    }
};

export const getFeatureShowcaseSectionById = async (req: Request, res: Response) => {
    const { id } = req.body;

    try {
        const section = await prisma.featureShowcaseSection.findUnique({
            where: { id },
            include: { features: true, images: true },
        });

        if (!section) {
            return res.status(404).json({ message: 'Section not found' });
        }

        return res.status(200).json(section);
    } catch (error: unknown) {
        console.error(`Error fetching section with id ${id}:`, error);

        const message =
            error instanceof Error ? error.message : 'An unexpected error occurred';

        return res.status(500).json({ error: message });
    }
};

export const createFeatureShowcaseSection = async (req: Request, res: Response) => {
    try {
        const {
            headingTop,
            headingMain,
            headingMainStyled,
            title,
            titleStyled,
            subtitle,
            background,
            order,
            features,
            images,
        } = req.body;

        // Upload image (to be added inside the images relation)
        let uploadedImage = null;
        if (req.file) {
            const imageUrl = await uploadImageToGCS(req.file, 'featureShowcase/sections');
            uploadedImage = { url: imageUrl }; // adjust key name if your FeatureShowcaseImage model uses a different field
        }

        const section = await prisma.featureShowcaseSection.create({
            data: {
                headingTop,
                headingMain,
                headingMainStyled: headingMainStyled ? JSON.parse(headingMainStyled) : null,
                title,
                titleStyled: titleStyled ? JSON.parse(titleStyled) : null,
                subtitle,
                background,
                order: order ? Number(order) : undefined,
                features: features ? { create: JSON.parse(features) } : undefined,
                images: {
                    create: [
                        ...(images ? JSON.parse(images) : []),
                        ...(uploadedImage ? [uploadedImage] : []), // 👈 add uploaded image here
                    ],
                },
            },
            include: { features: true, images: true },
        });

        return res.status(201).json(section);
    } catch (error: unknown) {
        console.error('Error creating feature section:', error);

        const message =
            error instanceof Error ? error.message : 'An unexpected error occurred';

        return res.status(500).json({ error: message });
    }
};

export const updateFeatureShowcaseSection = async (req: Request, res: Response) => {
    try {
        const {
            id,
            headingTop,
            headingMain,
            headingMainStyled,
            title,
            titleStyled,
            subtitle,
            background,
            order,
            features,
            images,
            isActive,
        } = req.body;

        // Upload new image (to be added in images relation)
        let uploadedImage = null;
        if (req.file) {
            const imageUrl = await uploadImageToGCS(req.file, 'featureShowcase/sections');
            uploadedImage = { url: imageUrl }; // adjust key name if your model uses different fields
        }

        // Build update data dynamically
        const updateData: any = {
            headingTop,
            headingMain,
            headingMainStyled: headingMainStyled ? JSON.parse(headingMainStyled) : undefined,
            title,
            titleStyled: titleStyled ? JSON.parse(titleStyled) : undefined,
            subtitle,
            background,
            order: order ? Number(order) : undefined,
            isActive,
        };

        // Handle features — fully replace if provided
        if (features) {
            updateData.features = {
                deleteMany: {}, // remove existing
                create: JSON.parse(features), // add new
            };
        }

        // Handle images — append new ones (don't delete existing)
        const newImages = [
            ...(images ? JSON.parse(images) : []),
            ...(uploadedImage ? [uploadedImage] : []),
        ];

        if (newImages.length > 0) {
            updateData.images = {
                create: newImages, // add new images
            };
        }

        const section = await prisma.featureShowcaseSection.update({
            where: { id },
            data: updateData,
            include: { features: true, images: true },
        });

        return res.status(200).json(section);
    } catch (error: unknown) {
        console.error('Error updating feature section:', error);

        const message =
            error instanceof Error ? error.message : 'An unexpected error occurred';

        return res.status(500).json({ error: message });
    }
};


export const deleteFeatureShowcaseSection = async (req: Request, res: Response) => {
  try {
    const { id } = req.body;

    const existingSection = await prisma.featureShowcaseSection.findUnique({
      where: { id },
      include: { features: true, images: true },
    });

    if (!existingSection) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Delete related data first
    await prisma.featureShowcaseFeature.deleteMany({ where: { sectionId: id } });
    await prisma.featureShowcaseImage.deleteMany({ where: { sectionId: id } });

    // Then delete the section
    await prisma.featureShowcaseSection.delete({ where: { id } });

    return res.status(200).json({ message: 'Section deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting feature section:', error);

    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';

    return res.status(500).json({ error: message });
  }
};


export const addFeatureToSection = async (req: Request, res: Response) => {
    const { id,title, description, order } = req.body;

    try {
        const sectionExists = await prisma.featureShowcaseSection.findUnique({
            where: { id },
        });

        if (!sectionExists) {
            return res.status(404).json({ message: 'Section not found' });
        }

        const feature = await prisma.featureShowcaseFeature.create({
            data: {
                sectionId: id,
                title,
                description,
                order: order ? Number(order) : undefined,
            },
        });

        return res.status(201).json(feature);
    } catch (error: unknown) {
        console.error(`Error adding feature to section ${id}:`, error);

        const message =
            error instanceof Error ? error.message : 'An unexpected error occurred';

        return res.status(500).json({ error: message });
    }
};

export const updateFeatureOfSection = async (req: Request, res: Response) => {
    const {id, title, description, order } = req.body;

    try {
        const existingFeature = await prisma.featureShowcaseFeature.findUnique({
            where: { id },
        });

        if (!existingFeature) {
            return res.status(404).json({ message: 'Feature not found' });
        }

        const feature = await prisma.featureShowcaseFeature.update({
            where: { id },
            data: {
                title,
                description,
                order: order ? Number(order) : undefined,
            },
        });

        return res.status(200).json(feature);
    } catch (error: unknown) {
        console.error(`Error updating feature with id ${id}:`, error);

        const message =
            error instanceof Error ? error.message : 'An unexpected error occurred';

        return res.status(500).json({ error: message });
    }
};

export const deleteFeatureOfSection = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        // Check if the feature exists before deleting
        const existingFeature = await prisma.featureShowcaseFeature.findUnique({
            where: { id },
        });

        if (!existingFeature) {
            return res.status(404).json({ message: 'Feature not found' });
        }

        await prisma.featureShowcaseFeature.delete({ where: { id } });

        return res.status(200).json({ message: 'Feature deleted successfully' });
    } catch (error: unknown) {
        console.error(`Error deleting feature with id ${id}:`, error);

        const message =
            error instanceof Error ? error.message : 'An unexpected error occurred';

        return res.status(500).json({ error: message });
    }
};
