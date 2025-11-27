import { Storage } from "@google-cloud/storage";

const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GCP_KEYFILE_PATH,
});

const bucket = storage.bucket(process.env.GCP_BUCKET!);

export const uploadImageToGCS = async (file: Express.Multer.File, folder: string) => {
    if (!file) throw new Error("No file provided");

    const safeName = file.originalname.replace(/\s+/g, "_");
    const fileName = `static/${folder}/${safeName}_${Date.now()}`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: file.mimetype,
    });

    return new Promise<string>((resolve, reject) => {
        blobStream.on("finish", async () => {
            try {
                await blob.makePublic();
                resolve(`https://storage.googleapis.com/${bucket.name}/${fileName}`);
            } catch (err) {
                reject(err);
            }
        });
        blobStream.on("error", (err) => reject(err));
        blobStream.end(file.buffer);
    });
};

