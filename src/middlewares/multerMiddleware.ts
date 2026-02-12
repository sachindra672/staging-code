import multer from "multer";

const storage = multer.memoryStorage();

export const upload = multer({ storage });

// Middleware for single file upload
export const uploadSingle = (fieldName: string) => upload.single(fieldName);

// Middleware for multiple file upload
export const uploadMultiple = (fieldName: string, maxCount: number) =>
    upload.array(fieldName, maxCount);
