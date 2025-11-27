import { Request, Response } from 'express';
import { prisma } from './misc'
import { getCache, setCache, invalidateCache } from './utils/cacheUtils';
import { Storage } from '@google-cloud/storage';
import { nanoid } from 'nanoid';
import { v4 as uuidv4 } from "uuid";

const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GCP_KEYFILE_PATH, 
});

const bucket = storage.bucket(process.env.GCP_BUCKET!);

export const generateBlogAssetUploadUrl = async (_req: Request, res: Response) => {
    try {
        const date = new Date();
        const fileName = `blog-assets/${nanoid()}-${date.getTime()}.jpeg`;
        const file = bucket.file(fileName);

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 10 * 60 * 1000, 
            contentType: 'image/*',
        });

        res.json({
            uploadUrl: url,
            filePath: `https://storage.googleapis.com/${process.env.GCP_BUCKET}/${fileName}`,
        });
    } catch (err) {
        console.error('Error generating GCS upload URL:', err);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
};

export const getAllBlogs = async (req: Request, res: Response) => {
    try {
        const page = Number(req.body.page) || 1;
        const limit = Number(req.body.limit) || 10;
        const skip = (page - 1) * limit;

        const cacheKey = `blogs:page:${page}:limit:${limit}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json({ cached: true, ...cached });

        const [blogs, total] = await Promise.all([
            prisma.blog.findMany({
                skip,
                take: limit,
                where: { deleted: false },
                orderBy: { publishedAt: 'desc' },
                include: { tags: { include: { tag: true } }, likedBy: true },
            }),
            prisma.blog.count({ where: { deleted: false } }),
        ]);

        const data = { total, page, limit, blogs };
        await setCache(cacheKey, data, 120);
        res.json(data);
    } catch (err) {
        console.error('Error fetching blogs:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const createBlog = async (req: Request, res: Response) => {
    try {
        const { title, banner, des, content, authorName, authorProfile, tags } = req.body;

        const newBlog = await prisma.blog.create({
            data: {
                title,
                banner,
                des,
                content,
                authorName,
                authorProfile,
                tags: {
                    create: tags?.map((tagId: string) => ({
                        tag: { connect: { id: tagId } },
                    })),
                },
            },
        });

        await invalidateCache('blogs:*');
        res.json(newBlog);
    } catch (err) {
        console.error('Error creating blog:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const createBlog2 = async (req: Request, res: Response) => {
    try {
        const { title, banner, des, content, authorName, authorProfile, tags } = req.body;

        const newBlog = await prisma.blog.create({
            data: {
                title,
                banner,
                des,
                content,
                authorName,
                authorProfile,
                tags: tags?.length
                    ? {
                        create: tags.map((tag: { id: string; name: string }) => ({
                            tag: {
                                connectOrCreate: {
                                    where: { id: tag.id },
                                    create: { id: tag.id, name: tag.name },
                                },
                            },
                        })),
                    }
                    : undefined,
            },
        });

        await invalidateCache('blogs:*');
        res.json(newBlog);
    } catch (err) {
        console.error('Error creating blog:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const createBlog3 = async (req: Request, res: Response) => {
    try {
        const { title, banner, des, content, authorName, authorProfile, tags } = req.body;

        const newBlog = await prisma.blog.create({
            data: {
                title,
                banner,
                des,
                content,
                authorName,
                authorProfile,
                tags: tags?.length
                    ? {
                        create: tags.map((tag: { id?: string; name?: string }) => {
                            const tagId = tag.id || uuidv4();
                            const tagName = tag.name || `Untitled-${uuidv4()}`; // unique fallback
                            return {
                                tag: {
                                    connectOrCreate: {
                                        where: { id: tagId },
                                        create: { id: tagId, name: tagName },
                                    },
                                },
                            };
                        }),
                    }
                    : undefined,
            },
        });

        await invalidateCache('blogs:*');
        res.json(newBlog);
    } catch (err) {
        console.error('Error creating blog:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const getBlogById = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;
        const cacheKey = `blog:${id}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const blog = await prisma.blog.findUnique({
            where: { id, deleted: false },
            include: {
                tags: { include: { tag: true } },
                likedBy: true,
                comments: {
                    where: { isReply: false },
                    include: { children: true, commentedBy: true },
                    orderBy: { commentedAt: 'desc' },
                },
            },
        });

        if (!blog) return res.status(404).json({ error: 'Blog not found' });

        await setCache(cacheKey, blog, 180);
        res.json(blog);
    } catch (err) {
        console.error('Error fetching blog:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateBlog = async (req: Request, res: Response) => {
    try {
        const { id, title, banner, des, content, authorName, authorProfile, tags } = req.body;

        const updatedBlog = await prisma.blog.update({
            where: { id },
            data: {
                title,
                banner,
                des,
                content,
                authorName,
                authorProfile,

                // Handle tags exactly like createBlog2
                tags: tags?.length
                    ? {
                        deleteMany: {},   // remove all old tags
                        create: tags.map((tag: { id: string; name: string }) => ({
                            tag: {
                                connectOrCreate: {
                                    where: { id: tag.id },
                                    create: { id: tag.id, name: tag.name },
                                },
                            },
                        })),
                    }
                    : undefined,
            },
        });

        await invalidateCache(`blog:${id}`);
        await invalidateCache('blogs:*');

        res.json(updatedBlog);
    } catch (err) {
        console.error('Error updating blog:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const deleteBlog = async (req: Request, res: Response) => {
    try {
        const { id } = req.body;

        const updated = await prisma.blog.update({
            where: { id },
            data: {
                deleted: true,
                deletedAt: new Date(),
            },
        });

        await invalidateCache(`blog:${id}`);
        await invalidateCache('blogs:*');
        await invalidateCache('blogs:trending');

        res.json({ success: true, message: "Blog soft-deleted successfully" });
    } catch (err) {
        console.error('Error soft deleting blog:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const toggleLikeBlog = async (req: Request, res: Response) => {
    try {
        const { blogId, userId } = req.body;
        const existing = await prisma.blogLike.findUnique({
            where: { blogId_userId: { blogId, userId } },
        });

        if (existing) {
            await prisma.blogLike.delete({ where: { blogId_userId: { blogId, userId } } });
            await prisma.blog.update({
                where: { id: blogId },
                data: { activityLikes: { decrement: 1 } },
            });
        } else {
            await prisma.blogLike.create({ data: { blogId, userId } });
            await prisma.blog.update({
                where: { id: blogId },
                data: { activityLikes: { increment: 1 } },
            });
        }

        await invalidateCache(`blog:${blogId}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Error toggling like:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const addComment = async (req: Request, res: Response) => {
    try {
        const { blogId, comment, commentedById, parentId } = req.body;
        const isReply = Boolean(parentId);

        const newComment = await prisma.comment.create({
            data: { blogId, comment, commentedById, parentId, isReply },
        });

        await prisma.blog.update({
            where: { id: blogId },
            data: {
                activityComments: { increment: 1 },
                activityParentComments: isReply ? undefined : { increment: 1 },
            },
        });

        await invalidateCache(`blog:${blogId}`);
        res.json(newComment);
    } catch (err) {
        console.error('Error adding comment:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllTags = async (_req: Request, res: Response) => {
    try {
        const cacheKey = 'tags:all';
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } });
        await setCache(cacheKey, tags, 3600);
        res.json(tags);
    } catch (err) {
        console.error('Error fetching tags:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const deleteTag = async (req: Request, res: Response) => {
    try {
        const { tagId } = req.body;

        // First remove from BlogTag junction table
        await prisma.blogTag.deleteMany({
            where: { tagId },
        });

        // Delete the tag
        await prisma.tag.delete({
            where: { id: tagId },
        });

        // Invalidate caches
        await invalidateCache('tags:*');
        await invalidateCache('blogs:*');
        await invalidateCache('blogs:trending');

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting tag:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getBlogsByTag = async (req: Request, res: Response) => {
    try {
        const { tagId } = req.body;

        if (!tagId) return res.status(400).json({ error: "tagId is required" });

        const cacheKey = `blogs:tag:${tagId}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json({ cached: true, ...cached });

        const blogs = await prisma.blog.findMany({
            where: {
                deleted: false, 
                tags: {
                    some: { tagId }
                }
            },
            orderBy: { publishedAt: "desc" },
            include: {
                tags: { include: { tag: true } },
                likedBy: true,
            }
        });

        const data = { tagId, blogs };
        await setCache(cacheKey, data, 300);

        res.json(data);

    } catch (err) {
        console.error("Error fetching blogs by tag:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


export const getNestedComments = async (req: Request, res: Response) => {
    try {
        const { blogId } = req.body;
        const cacheKey = `blog:${blogId}:comments`;

        const cached = await getCache(cacheKey);
        if (cached) return res.json({ cached: true, ...cached });

        const comments = await prisma.comment.findMany({
            where: { blogId, isReply: false },
            include: {
                commentedBy: true,
                children: {
                    include: { commentedBy: true },
                    orderBy: { commentedAt: 'asc' },
                },
            },
            orderBy: { commentedAt: 'desc' },
        });

        const result = { blogId, comments };
        await setCache(cacheKey, result, 120);
        res.json(result);
    } catch (err) {
        console.error('Error fetching nested comments:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getTrendingBlogs = async (_req: Request, res: Response) => {
    try {
        const cacheKey = 'blogs:trending';
        const cached = await getCache(cacheKey);
        if (cached) return res.json({ cached: true, ...cached });

        // Weight formula: score = (likes * 3) + (comments * 2) + (reads * 1) -> not using for now
        const blogs = await prisma.blog.findMany({
            select: {
                id: true,
                title: true,
                banner: true,
                des: true,
                authorName: true,
                publishedAt: true,
                activityLikes: true,
                activityComments: true,
                activityReads: true,
                tags: { include: { tag: true } },
            },
            where: { deleted: false },  
            orderBy: {
                publishedAt: 'desc',
            },
        });

        const ranked = blogs
            .map((b) => ({
                ...b,
                score:
                    // b.activityLikes * 1 +
                    // b.activityComments * 1 +
                    b.activityReads * 1,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        await setCache(cacheKey, ranked, 300);
        res.json({ trending: ranked });
    } catch (err) {
        console.error('Error fetching trending blogs:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateBlogReadCount = async (req: Request, res: Response) => {
    try {
        const { blogId } = req.body;

        const updated = await prisma.blog.update({
            where: { id: blogId },
            data: {
                activityReads: { increment: 1 },
            },
            select: {
                id: true,
                activityReads: true,
            },
        });

        await invalidateCache(`blog:${blogId}`);
        await invalidateCache('blogs:*');
        await invalidateCache('blogs:trending');

        res.json({ success: true, updatedReads: updated.activityReads });
    } catch (err) {
        console.error('Error updating read count:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};