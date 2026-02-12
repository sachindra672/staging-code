import { Request, Response, NextFunction } from 'express';
import { prisma } from "./misc"
import * as jwt from 'jsonwebtoken';


import { ERROR_MESSAGE } from './consts';
import { getUsers } from "./adminHelperFuncs";
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const ADMIN_JWT_SECRET = `3f608a29aa380c72577a12a7659aa3f9082cc024bd5f9d2b7fc6deb1d5e388dc1312f28b880da11361d8ba7865a01df8a477066b2d3f89cf767b7ddd353db42a72aa069044c8a3e0153efc5f47a30a2bfdb2d98df628dd60df845faeb95816d594c1b8cf0cb22da037714d1e5add6896e91141ee625b5cd0e6d1750bae157761233633bae4dc8347f62bef168ad5263b9cee22eff163d5c354a4afb9bcaa501b434e0d38acc8b08a381166708a08522600fcb6119d771e24ecd89295dc6dda303236f2f3293fb029d39fe113c024d23ce333e10b57df57eb3d86bb00d181d3b7e575679b15f82896ed0a28bc0960b642bc5c1437376e402f0ba97457659592a63078cce39e12056df7e6563a5b99be25a38c790ad01f25fddbde217490472e157b611c49546f67c58ad063215e7b7b1a73b1f57877d33e42155a844ffd5aa6fd4491dc4c28f56915f58d80135593bdef1152380b99b8f5d066164824c742ad5d7d5db9923744243ea39a7ddbed3c1a7e4cde1bb462b7500117d44067e86e5c17d44cca611308948af7d38380a7d924a8f2673c573985471860afb99c4687a120294b0d2ac8f10937ca531b090c818f884519ffbee10f3f337adb23bcf9afe100966871b5531dd4b3412797fd9b5bf6245609288a2b4568e566c8e9bb4b553fa099909e58c1b874c97113aab1e6d08483e39a618f790f28a9efab45e750c1710fa225db9d6f8e9b4fb5d352305f82e8fec63d195ea55d37b7c5fd873cc1e9601e7ce20b4105dfb29ac440c42cc7e134a8bb9b9f0f4d06e600f82fbce00c42b0172b8b05d898514ad5732278abca7780bcefbaa13fedbfb5a3f50a6733a74c25c9cde765fa2b160155401fa48f99ec280910dc86e8d11bad2b363f346479915a5623b7cb44428868c4e1dc4ef67479f98cd131d1addb2724b70f1963aefcc1fbf6d4e85fff437e5c557b04568f2e18ebdf0acd402202689ade7c7d7e374bef0cf33603e134da668d26152f98772fb78410f45e172e915e7ba79860136b4e1b7b624bb55f5d11daa86e44a3185cdce02a1dcc0aae2bf9e55ace9ce09b8a04d495cb2f517e058e1264ed4664c4ee8be7e5dc422ef2ee7b7da7b3592ccbbd1c2a1867a34796d0fc4d15dcc8edd30ab71fd52ce3937e3d93154909b319122030ddb7abcba970cc1569ba1edcef3396347ff8d9326562abcdc63cc76b9b9202b881052a07a463881289d3fe1ddddb95b66e9d6de76bfed01d6e20563d8065d5550cbf198daaa4a770987aea4578bc62b6777674c6fbadd8d92ad5104931ed891e3437459f27adb3e38096fcece5f4a3e9dda2d0a4d86934716537ac6a4ade450c7f9cd90bfc23f0a83a768a9a5c24966ca3eafcad64f96962423b82d3c5691881cb1d660f314545aaada97de7896b2985fa3b6de35322dc4dd394d76e3459ed11ab2cab`
const TOKEN_LIFE = `20d`

interface AdminCreds {
    user: string
    password: string
}

const credFilePath = path.join(__dirname, "../", "adCreds.json")
const ReadAdminIdPassword = () => JSON.parse(readFileSync(credFilePath).toString()) as AdminCreds
const UpdateAdminIdPasswd = (credentials: AdminCreds) => writeFileSync(credFilePath, JSON.stringify(credentials))

export function generateAccessTokenAdmin(parameters: object) {
    return jwt.sign({ ...parameters }, ADMIN_JWT_SECRET, { expiresIn: TOKEN_LIFE });
}

export function authenticateTokenAdmin(req: any, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization']
    const token = authHeader
    if (token == null) {
        return res.status(401).send("missing auth header")
    }
    jwt.verify(token, ADMIN_JWT_SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403)
        req.user = user
        next()
    })
}

export async function adminLoginUpdate(req: Request, res: Response) {
    try {
        const { user, password } = req.body
        UpdateAdminIdPasswd({ user, password })
        res.json({ success: true })
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })
    }
}
export async function adminLogin(req: Request, res: Response) {
    try {
        const { user, password } = req.body
        const credentials = ReadAdminIdPassword()

        if (user == credentials.user && password == credentials.password) {
            const token = generateAccessTokenAdmin({ user, password })
            res.json({ success: true, token })
        } else {
            res.json({ success: false, message: "admin id/password mismatch" })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, error })
    }
}

export async function GetStudent(req: Request, res: Response) {
    const { id } = req.body

    if (!id) return res.status(400).send("student ID required")

    try {
        const user = await prisma.endUsers.findUnique({ where: { id } })
        if (!user) return res.status(404).send("user not found")
        res.json(user)
    } catch (error) {
        console.log(error)
        res.status(500).send("something went wrong")
    }
}

export async function GetRecentStudents(req: Request, res: Response) {
    const { startId } = req.body

    try {
        const users = await getUsers(startId)
        res.json(users)
    } catch (error) {
        res.status(500).send({ success: false, error })
    }

}

export async function filterEndUsers(req: Request, res: Response) {
    try {
        const {
            type,
            minGrade,
            maxGrade,
            isVerified,
            minCreatedOn,
            maxCreatedOn,
            minModifiedOn,
            maxModifiedOn,
            page = 1,
            pageSize = 1000
        } = req.query;

        // Ensure page and pageSize are numbers and within the allowed limits
        const pageNum = parseInt(page as string, 10);
        let pageSizeNum = parseInt(pageSize as string, 10);
        if (pageSizeNum > 1000) pageSizeNum = 1000;

        // Validate range filters
        if (
            (minGrade !== undefined && maxGrade === undefined) || (minGrade === undefined && maxGrade !== undefined)) {
            return res.
                status(400)
                .json({ error: "Both minGrade and maxGrade must be provided for grade range filter." });
        }
        if ((minCreatedOn !== undefined && maxCreatedOn === undefined) || (minCreatedOn === undefined && maxCreatedOn !== undefined)) {
            return res
                .status(400)
                .json({ error: "Both minCreatedOn and maxCreatedOn must be provided for createdOn range filter." });
        }
        if ((minModifiedOn !== undefined && maxModifiedOn === undefined) || (minModifiedOn === undefined && maxModifiedOn !== undefined)) {
            return res
                .status(400)
                .json({ error: "Both minModifiedOn and maxModifiedOn must be provided for modifiedOn range filter." });
        }

        const filters: any = {};

        if (type != "Student") {
            return res
                .status(400)
                .json({ error: "Only students are searchable" });

        }
        if (minGrade !== undefined && maxGrade !== undefined) {
            filters.grade = {
                gte: parseInt(minGrade as string, 10),
                lte: parseInt(maxGrade as string, 10)
            };
        }
        if (isVerified !== undefined) filters.isVerified = isVerified === 'true';

        if (minCreatedOn !== undefined && maxCreatedOn !== undefined) {
            filters.createdOn = {
                gte: new Date(minCreatedOn as string),
                lte: new Date(maxCreatedOn as string)
            };
        }

        if (minModifiedOn !== undefined && maxModifiedOn !== undefined) {
            filters.modifiedOn = {
                gte: new Date(minModifiedOn as string),
                lte: new Date(maxModifiedOn as string)
            };
        }

        const endUsers = await prisma.endUsers.findMany({
            where: filters,
            skip: (pageNum - 1) * pageSizeNum,
            take: pageSizeNum,
        });

        return res.status(200).json(endUsers);
    } catch (error) {
        console.error("Error filtering endUsers:", error);
        return res.status(500).json(ERROR_MESSAGE);
    }
}
