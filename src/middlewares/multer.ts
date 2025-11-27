import multer from "multer";

// store in memory as Buffer
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024, 
    },
    fileFilter: (_req, file, cb) => {
        if (
            file.mimetype === "application/vnd.ms-powerpoint" || // .ppt
            file.mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation" // .pptx
        ) {
            cb(null, true);
        } else {
            cb(new Error("Only PPT/PPTX files are allowed!"));
        }
    },
});

export default upload;
