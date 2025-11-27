import { parse } from 'csv-parse';
import { Buffer } from 'buffer';
import argon2 from 'argon2';
import * as jwt from 'jsonwebtoken'
import { Response, Request, NextFunction } from 'express';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs'
import sharp from 'sharp';

export const TOKEN_LIFE = "60d"
export const SECRET = `3f608a29aa380c72577a12a7659aa3f9082cc024bd5f9d2b7fc6deb1d5e388dc1312f28b880da11361d8ba7865a01df8a477066b2d3f89cf767b7ddd353db42a72aa069044c8a3e0153efc5f47a30a2bfdb2d98df628dd60df845faeb95816d594c1b8cf0cb22da037714d1e5add6896e91141ee625b5cd0e6d1750bae157761233633bae4dc8347f62bef168ad5263b9cee22eff163d5c354a4afb9bcaa501b434e0d38acc8b08a381166708a08522600fcb6119d771e24ecd89295dc6dda303236f2f3293fb029d39fe113c024d23ce333e10b57df57eb3d86bb00d181d3b7e575679b15f82896ed0a28bc0960b642bc5c1437376e402f0ba97457659592a63078cce39e12056df7e6563a5b99be25a38c790ad01f25fddbde217490472e157b611c49546f67c58ad063215e7b7b1a73b1f57877d33e42155a844ffd5aa6fd4491dc4c28f56915f58d80135593bdef1152380b99b8f5d066164824c742ad5d7d5db9923744243ea39a7ddbed3c1a7e4cde1bb462b7500117d44067e86e5c17d44cca611308948af7d38380a7d924a8f2673c573985471860afb99c4687a120294b0d2ac8f10937ca531b090c818f884519ffbee10f3f337adb23bcf9afe100966871b5531dd4b3412797fd9b5bf6245609288a2b4568e566c8e9bb4b553fa099909e58c1b874c97113aab1e6d08483e39a618f790f28a9efab45e750c1710fa225db9d6f8e9b4fb5d352305f82e8fec63d195ea55d37b7c5fd873cc1e9601e7ce20b4105dfb29ac440c42cc7e134a8bb9b9f0f4d06e600f82fbce00c42b0172b8b05d898514ad5732278abca7780bcefbaa13fedbfb5a3f50a6733a74c25c9cde765fa2b160155401fa48f99ec280910dc86e8d11bad2b363f346479915a5623b7cb44428868c4e1dc4ef67479f98cd131d1addb2724b70f1963aefcc1fbf6d4e85fff437e5c557b04568f2e18ebdf0acd402202689ade7c7d7e374bef0cf33603e134da668d26152f98772fb78410f45e172e915e7ba79860136b4e1b7b624bb55f5d11daa86e44a3185cdce02a1dcc0aae2bf9e55ace9ce09b8a04d495cb2f517e058e1264ed4664c4ee8be7e5dc422ef2ee7b7da7b3592ccbbd1c2a1867a34796d0fc4d15dcc8edd30ab71fd52ce3937e3d93154909b319122030ddb7abcba970cc1569ba1edcef3396347ff8d9326562abcdc63cc76b9b9202b881052a07a463881289d3fe1ddddb95b66e9d6de76bfed01d6e20563d8065d5550cbf198daaa4a770987aea4578bc62b6777674c6fbadd8d92ad5104931ed891e3437459f27adb3e38096fcece5f4a3e9dda2d0a4d86934716537ac6a4ade450c7f9cd90bfc23f0a83a768a9a5c24966ca3eafcad64f96962423b82d3c5691881cb1d660f314545aaada97de7896b2985fa3b6de35322dc4dd394d76e3459ed11ab2cab`
// `b26d33278121a9e6d45ce5b2b7c7f13f08f359dd6a42cef58261316f6704aee169acec0a8535378e643e4554f3f76001fef561dc7a1c82f509131ddb8e89b863ccce7efde65db49f1f81909426c96df11e4e7d86de73415c0863467ebf8804267ada215b43e373199a2a2b9d9d379b2b4bbb0c8c2d7636ae0e47d6db925d1100`

export const prisma = new PrismaClient()

export enum UserRole {
    mentor = "mentor",
    endUser = "endUser",
    admin = "admin",
    subAdmin = "subadmin"
}

export class UserJwtInfo {
    role: UserRole;
    selfId: string;

    constructor(role: UserRole, id: string) {
        this.role = role;
        this.selfId = id;
    }
}

export const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
});

export function generateAccessTokenUser(parameters: object) {
    return jwt.sign({ ...parameters }, SECRET, { expiresIn: TOKEN_LIFE });
}

export function MultiRoleAutheticate(role: UserJwtInfo) {
    return function (req: any, res: Response, next: NextFunction) {
        const authHeader = req.headers['authorization']
        const token = authHeader
        if (token == null) {
            return res.status(401).send("missing auth header")
        }
        jwt.verify(token, SECRET, (err: any, user: any) => {
            if (err) return res.sendStatus(403)

            if (user.role != role) res.sendStatus(403)

            req.user = user
            req.headers.set("info", JSON.stringify(user))
            next()
        })

    }
}

export function authenticateTokenUser(req: any, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization']
    const token = authHeader
    if (token == null) {
        return res.status(401).send("missing auth header")
    }
    jwt.verify(token, SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403)
        req.user = user
        req.headers.set("info", JSON.stringify(user))
        next()
    })
}
/**
 * 
 * temp function, meant to be disabled in prod
*/
export async function getRedisContents(_: Request, res: Response) {
    try {
        const keys = await redis.keys('*');
        const contents: { [key: string]: string | null } = {};

        for (const key of keys) {
            const value = await redis.get(key);
            contents[key] = value;
        }

        res.json(contents);
    } catch (err) {
        console.error('Error fetching Redis contents:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export async function sendMsgx(_phone: string, template: string) {
    console.log("sending message", template)
    fetch("https://control.msg91.com/api/v5/flow", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "authkey": "428210ARKHcp5hTYi66e82652P1"
        },
        body: JSON.stringify({
            "template_id": template,
            "short_url": "0",
            "realTimeResponse": "1",
            "recipients": [{ "mobiles": "91" + _phone, }]
        })
    }).then(e => e.text()).then(console.log).catch(console.log)
}

export async function sendOtp(_phone: string, _otp: string) {
    fetch("https://control.msg91.com/api/v5/flow", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "authkey": "428210ARKHcp5hTYi66e82652P1"
        },
        body: JSON.stringify({
            "template_id": "66e929bed6fc0528de5a3437",
            "short_url": "0",
            "realTimeResponse": "1",
            "recipients": [
                {
                    "mobiles": "91" + _phone,
                    "OTP": _otp
                }
            ]
        })
    })
}


export async function sendOtpReg(_phone: string, _otp: string) {
    fetch("https://control.msg91.com/api/v5/flow", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "authkey": "428210ARKHcp5hTYi66e82652P1"
        },
        body: JSON.stringify({
            "template_id": "66e929bed6fc0528de5a3437",
            "short_url": "0",
            "realTimeResponse": "1",
            "recipients": [
                {
                    "mobiles": "91" + _phone,
                    "OTP": _otp
                }
            ]
        })
    })
}



export async function sendLink(_phone: string) {
    fetch("https://control.msg91.com/api/v5/flow", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "authkey": "428210ARKHcp5hTYi66e82652P1"
        },
        body: JSON.stringify({
            "template_id": "67923b29d6fc050bf8495373",
            "short_url": "0",
            "realTimeResponse": "1",
            "recipients": [{ "mobiles": "91" + _phone, }]
        })
    })
}

export async function downlinkMessage(req: Request, res: Response) {
    try {
        const { phone } = req.body
        await sendLink(phone)

        res.json({ "success": true })
    } catch (err) {
        console.error('Error fetching Redis contents:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export function areValidStrings(...values: string[]): boolean {
    return values.every(val => typeof val === "string" && val.trim().length > 0);
}



/**
 * Hashes a password using Argon2id.
 * @param password - The plain text password to hash.
 * @returns The hashed password.
 */
export async function hashPassword(password: string): Promise<string> {
    try {
        const hash = await argon2.hash(password, {
            type: argon2.argon2id,
        });
        return hash;
    } catch (err) {
        throw new Error('Error hashing password: ' + err);
    }
}

/**
 * Verifies a password against a given hash.
 * @param password - The plain text password to verify.
 * @param hash - The hash to verify against.
 * @returns True if the password matches the hash, false otherwise.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
        return await argon2.verify(hash, password);
    } catch (err) {
        throw new Error('Error verifying password: ' + err);
    }
}


export async function uploadImage(imageData: string | undefined, id: number, subDir: string): Promise<void> {
    try {
        if (imageData && imageData !== '') {
            const imageBuffer = Buffer.from(imageData, 'base64');
            const imageDir = path.join(__dirname, '../thumbs', subDir);
            const imagePath = path.join(imageDir, `${id}.jpg`);

            fs.mkdirSync(imageDir, { recursive: true });

            if (!fs.existsSync(imageDir)) {
                fs.mkdirSync(imageDir)
            }

            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }

            await sharp(imageBuffer)
                .toFormat('jpg')
                .toFile(imagePath);
        }
    } catch (error) {
        console.log(error)
    }
}

export async function uploadBanner(imageData: string | undefined, name: string, id: number): Promise<void> {
    try {
        if (imageData && imageData !== '') {
            const imageBuffer = Buffer.from(imageData, 'base64');
            const imageDir = path.join(__dirname, '../thumbs/banners/', id.toString());
            const imagePath = path.join(imageDir, `${name.split(".")[0]}.jpg`);

            fs.mkdirSync(imageDir, { recursive: true });

            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }

            await sharp(imageBuffer)
                .toFormat('jpeg')
                .toFile(imagePath);
        }
    } catch (error) {
        console.log(error)
    }

}

export async function uploadBanner2(imageData: string | undefined, name: string, final_dir: string): Promise<void> {
    try {

        if (imageData && imageData !== '') {
            const imageBuffer = Buffer.from(imageData, 'base64');
            const imageDir = path.join(__dirname, '../thumbs/banners/', final_dir);
            const imagePath = path.join(imageDir, `${name.split(".")[0]}.jpg`);

            fs.mkdirSync(imageDir, { recursive: true });

            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }

            await sharp(imageBuffer)
                .toFormat('jpeg')
                .toFile(imagePath);
        }
    } catch (error) {
        console.log(error)
    }

}


export async function uploadNotifImage(imageData: string | undefined, filename: string, subDir: string): Promise<void> {
    try {
        if (imageData && imageData !== '') {
            const imageBuffer = Buffer.from(imageData, 'base64');
            const imageDir = path.join(__dirname, '../thumbs', subDir);
            const imagePath = path.join(imageDir, `${filename.split(".")[0]}.jpg`);

            fs.mkdirSync(imageDir, { recursive: true });

            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }

            await sharp(imageBuffer)
                .toFormat('jpeg')
                .toFile(imagePath);
        }
    } catch (error) {
        console.log(error)
    }

}

export interface FieldData {
    name: string
    email: string
    phone: string
    city: string
    state: string
    misc: string
}

export async function parseCsvFromBase64(base64String: string): Promise<FieldData[]> {
    const csvData = Buffer.from(base64String, 'base64').toString('utf-8');

    const records: FieldData[] = await new Promise((resolve, reject) => {
        parse(csvData, {
            columns: true, // Use the first row as headers
            skip_empty_lines: true,
        }, (err, records: FieldData[]) => {
            if (err) {
                return reject(err);
            }
            resolve(records);
        });
    });

    return records;
}


export function splitFieldData(fieldData: FieldData[], salesmen: number[]): { [salesmanId: number]: FieldData[] } {
    const totalEntries = fieldData.length;
    const totalSalesmen = salesmen.length;
    const baseEntriesPerSalesman = Math.floor(totalEntries / totalSalesmen);
    const remainderEntries = totalEntries % totalSalesmen;
    const shuffledSalesmen = salesmen.sort(() => 0.5 - Math.random());
    const distribution: { [salesmanId: number]: FieldData[] } = {};

    let currentIndex = 0;
    for (const salesman of salesmen) {
        distribution[salesman] = fieldData.slice(currentIndex, currentIndex + baseEntriesPerSalesman);
        currentIndex += baseEntriesPerSalesman;
    }

    for (let i = 0; i < remainderEntries; i++) {
        distribution[shuffledSalesmen[i]].push(fieldData[currentIndex]);
        currentIndex++;
    }

    return distribution;
}

