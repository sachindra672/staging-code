import multer from "multer";
import path from "path";

// Storage configuration
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (_req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

// Multer instance with increased file size limit
export const uploadMiddleware = multer({
    storage,
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 1 GB
    },
}).fields([
    { name: "pdf", maxCount: 1 },
    { name: "watermark", maxCount: 1 },
]);
