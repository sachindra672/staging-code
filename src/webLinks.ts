import { prisma } from './misc'
import { Request, Response } from 'express'
import { uploadImageToGCS } from "./utils/gcsUpload";

export const createWebLinks=async (req:Request, res:Response) => {
    try {
        const { laptopVideoLink } = req.body;
        if (!req.file) return res.status(400).json({ error: 'Image is required' });

        const imageUrl = await uploadImageToGCS(req.file, 'webBanner');

        const webLink = await prisma.webLinks.create({
            data: {
                laptopVideoLink,
                webBannerImageLink: imageUrl,
            },
        });

        res.json(webLink);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const getwebLinks = async (_req:Request, res:Response) => {
    const links = await prisma.webLinks.findMany();
    res.json(links);
}

export const updateWebLinks = async (req: Request, res: Response) => {
    try {
        const { id, laptopVideoLink } = req.body;
        const data: any = {};

        if (laptopVideoLink) {
            data.laptopVideoLink = laptopVideoLink;
        }

        if (req.file) {
            data.webBannerImageLink = await uploadImageToGCS(req.file, 'webBanner');
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'No fields provided to update' });
        }

        const updated = await prisma.webLinks.update({
            where: { id },
            data,
        });

        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const deleteWebLinks = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.webLinks.delete({ where: { id } });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const createTestimonalReelLink = async (req:Request, res:Response) => {
    try {
        const { url, order } = req.body;
        const reel = await prisma.testimonialReel.create({
            data: { url, order: Number(order) },
        });
        res.json(reel);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const getTestimonialReelLink = async (_req: Request, res: Response) => {
    const reels = await prisma.testimonialReel.findMany({
        orderBy: { order: 'asc' },
    });
    res.json(reels);
}

export const updateTestimonialReelLink = async (req:Request, res:Response) => {
    try {
        const { id,url, order } = req.body;
        const updated = await prisma.testimonialReel.update({
            where: { id },
            data: { url, order: Number(order) },
        });
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const deleteTestimonialReelLink = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;
        await prisma.testimonialReel.delete({ where: { id } });
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

export const createBanner = async (req: Request, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Image required" });

        const imageUrl = await uploadImageToGCS(req.file, "webBanner");

        const banner = await prisma.webBanner.create({
            data: { imageLink: imageUrl }
        });

        res.json(banner);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const createVideo = async (req: Request, res: Response) => {
    try {
        const { laptopVideoLink } = req.body;
        if (!laptopVideoLink) return res.status(400).json({ error: "video link required" });

        const video = await prisma.webVideo.create({
            data: { videoLink: laptopVideoLink }
        });

        res.json(video);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const deleteBanner = async (req: Request, res: Response) => {
    try {
        await prisma.webBanner.delete({ where: { id: req.params.id } });
        res.json({ message: "Banner deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const createWebBanner = async (req: Request, res: Response) => {
    try {
        const { href } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: "Image is required" });
        }

        const imageUrl = await uploadImageToGCS(req.file, "webBanner");

       
        const banner = await prisma.webBanner.create({
            data: { imageLink: imageUrl, href },
        });

        res.json(banner);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal server error" });
    }
};


export const getAllWebBanners = async (_req: Request, res: Response) => {
    try {
        const banners = await prisma.webBanner.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json(banners);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getWebBannerById = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        const banner = await prisma.webBanner.findUnique({
            where: { id },
        });

        if (!banner) return res.status(404).json({ error: "Banner not found" });

        res.json(banner);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateWebBanner = async (req: Request, res: Response) => {
    try {
        const { id, href } = req.body;

        let imageUrl;

        if (req.file) {
            imageUrl = await uploadImageToGCS(req.file, "webBanner");
        }

        const updated = await prisma.webBanner.update({
            where: { id },
            data: {
                href,
                ...(imageUrl && { imageLink: imageUrl }),
            },
        });

        res.json(updated);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal server error" });
    }
};


export const deleteWebBanner = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        const deleted = await prisma.webBanner.delete({
            where: { id },
        });

        res.json({ message: "Banner deleted", deleted });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const createWebVideo = async (req: Request, res: Response) => {
    try {
        const { videoLink } = req.body;

        const video = await prisma.webVideo.create({
            data: { videoLink },
        });

        res.json(video);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getAllWebVideos = async (_req: Request, res: Response) => {
    try {
        const videos = await prisma.webVideo.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json(videos);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getWebVideoById = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        const video = await prisma.webVideo.findUnique({
            where: { id },
        });

        if (!video) return res.status(404).json({ error: "Video not found" });

        res.json(video);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateWebVideo = async (req: Request, res: Response) => {
    try {
        const { id, videoLink } = req.body;

        const updated = await prisma.webVideo.update({
            where: { id },
            data: { videoLink },
        });

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteWebVideo = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        const deleted = await prisma.webVideo.delete({
            where: { id },
        });

        res.json({ message: "Video deleted", deleted });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const createCoursePageBanner = async (req: Request, res: Response) => {
    try {
        const { href } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: "Image is required" });
        }

        const imageUrl = await uploadImageToGCS(req.file, "coursePageBanner");

        const banner = await prisma.coursePageBanner.create({
            data: { imageLink: imageUrl, href },
        });

        res.json(banner);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal server error" });
    }
};


export const getAllCoursePageBanners = async (_req: Request, res: Response) => {
    try {
        const banners = await prisma.coursePageBanner.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json(banners);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};


export const getCoursePageBannerById = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        const banner = await prisma.coursePageBanner.findUnique({
            where: { id },
        });

        if (!banner) return res.status(404).json({ error: "Banner not found" });

        res.json(banner);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};


export const updateCoursePageBanner = async (req: Request, res: Response) => {
    try {
        const { id, href } = req.body;

        let imageUrl;

        if (req.file) {
            imageUrl = await uploadImageToGCS(req.file, "coursePageBanner");
        }

        const updated = await prisma.coursePageBanner.update({
            where: { id },
            data: {
                href,
                ...(imageUrl && { imageLink: imageUrl }),
            },
        });

        res.json(updated);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const createBlogAdBanner = async (req: Request, res: Response) => {
    try {
        const { href } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: "Image is required" });
        }

        const imageUrl = await uploadImageToGCS(req.file, "blogAdBanner");

        const banner = await prisma.blogAdBanner.create({
            data: { imageLink: imageUrl, href },
        });

        res.json(banner);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal server error" });
    }
};


export const getAllBlogAdBanners = async (_req: Request, res: Response) => {
    try {
        const banners = await prisma.blogAdBanner.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json(banners);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};


export const getBlogAdBannerById = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        const banner = await prisma.blogAdBanner.findUnique({
            where: { id },
        });

        if (!banner) return res.status(404).json({ error: "Banner not found" });

        res.json(banner);
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};


export const updateBlogAdBanner = async (req: Request, res: Response) => {
    try {
        const { id, href } = req.body;

        let imageUrl;

        if (req.file) {
            imageUrl = await uploadImageToGCS(req.file, "blogAdBanner");
        }

        const updated = await prisma.blogAdBanner.update({
            where: { id },
            data: {
                href,
                ...(imageUrl && { imageLink: imageUrl }),
            },
        });

        res.json(updated);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal server error" });
    }
};



export const deleteCoursePageBanner = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        await prisma.coursePageBanner.delete({ where: { id } });

        res.json({ message: "Course page banner deleted" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteBlogAdBanner = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        await prisma.blogAdBanner.delete({ where: { id } });

        res.json({ message: "Blog ad banner deleted" });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
};





