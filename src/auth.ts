import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Enums and Types
export enum UserRole {
    ADMIN = 'ADMIN',
    USER = 'USER'
}

export class UserJwtInfo {
    role: UserRole;
    selfId: string;
    loginTime: number;
    deviceId: string;

    constructor(role: UserRole, id: string, deviceId: string) {
        this.role = role;
        this.selfId = id;
        this.loginTime = Date.now();
        this.deviceId = deviceId;
    }
}

export interface LoginRequest {
    username: string;
    password: string;
    deviceId: string;
}

export interface RefreshTokenRequest {
    refreshToken: string;
}

export interface JwtConfig {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
}

// Error handling
export class AuthError extends Error {
    status: number;

    constructor(message: string, status: number = 401) {
        super(message);
        this.status = status;
        Object.setPrototypeOf(this, AuthError.prototype);
    }
}

// Input validation
export function validateLoginRequest(data: unknown): LoginRequest {
    if (!data || typeof data !== 'object') {
        throw new AuthError('Invalid request body', 400);
    }

    const req = data as any;
    if (!req.username || typeof req.username !== 'string' ||
        !req.password || typeof req.password !== 'string' ||
        !req.deviceId || typeof req.deviceId !== 'string') {
        throw new AuthError('Missing required fields', 400);
    }

    return {
        username: req.username,
        password: req.password,
        deviceId: req.deviceId
    };
}

export function validateRefreshTokenRequest(data: unknown): RefreshTokenRequest {
    if (!data || typeof data !== 'object') {
        throw new AuthError('Invalid request body', 400);
    }

    const req = data as any;
    if (!req.refreshToken || typeof req.refreshToken !== 'string') {
        throw new AuthError('Missing refresh token', 400);
    }

    return { refreshToken: req.refreshToken };
}

// Token service
export class TokenService {
    private config: JwtConfig;

    constructor(config: JwtConfig) {
        this.config = config;
    }

    public generateAccessToken(user: UserJwtInfo): string {
        return jwt.sign(
            { ...user },
            this.config.accessTokenSecret,
            { expiresIn: this.config.accessTokenExpiry }
        );
    }

    public generateRefreshToken(user: UserJwtInfo): string {
        return jwt.sign(
            {
                selfId: user.selfId,
                deviceId: user.deviceId,
                loginTime: user.loginTime
            },
            this.config.refreshTokenSecret,
            { expiresIn: this.config.refreshTokenExpiry }
        );
    }

    public verifyAccessToken(token: string): UserJwtInfo {
        try {
            const decoded = jwt.verify(token, this.config.accessTokenSecret) as UserJwtInfo;
            return decoded;
        } catch (error) {
            throw new AuthError('Invalid access token');
        }
    }

    public verifyRefreshToken(token: string): Pick<UserJwtInfo, 'selfId' | 'deviceId' | 'loginTime'> {
        try {
            return jwt.verify(token, this.config.refreshTokenSecret) as Pick<UserJwtInfo, 'selfId' | 'deviceId' | 'loginTime'>;
        } catch (error) {
            throw new AuthError('Invalid refresh token');
        }
    }
}

// Custom request interface
export interface AuthenticatedRequest extends Request {
    user?: UserJwtInfo;
}

// Middleware factory
export function createAuthMiddleware(
    tokenService: TokenService,
    options?: { selfIdentityField?: string }
) {
    return function (req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                throw new AuthError('No token provided');
            }

            const token = authHeader.split(' ')[1];
            const user = tokenService.verifyAccessToken(token);

            if (options?.selfIdentityField) {
                const requestedId = (req.params as any)[options.selfIdentityField];
                if (requestedId && requestedId !== user.selfId) {
                    throw new AuthError('Unauthorized access to resource', 403);
                }
            }

            req.user = user;
            next();
        } catch (error) {
            if (error instanceof AuthError) {
                res.status(error.status).json({ error: error.message });
            } else {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    };
}

// Route handlers
export function createAuthRoutes(tokenService: TokenService, userService: any) {
    const router = require('express').Router();

    router.post('/login', async function (req: Request, res: Response) {
        try {
            const loginData = validateLoginRequest(req.body);
            const user = await userService.validateCredentials(loginData.username, loginData.password);

            if (!user) {
                throw new AuthError('Invalid credentials');
            }

            const userJwtInfo = new UserJwtInfo(user.role, user.id, loginData.deviceId);

            const accessToken = tokenService.generateAccessToken(userJwtInfo);
            const refreshToken = tokenService.generateRefreshToken(userJwtInfo);

            await userService.storeRefreshToken(user.id, refreshToken, loginData.deviceId);

            res.json({
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    role: user.role
                }
            });
        } catch (error) {
            handleRouteError(error, res);
        }
    });

    router.post('/refresh', async function (req: Request, res: Response) {
        try {
            const { refreshToken } = validateRefreshTokenRequest(req.body);
            const decoded = tokenService.verifyRefreshToken(refreshToken);

            const user = await userService.validateRefreshToken(
                decoded.selfId,
                refreshToken,
                decoded.deviceId
            );

            if (!user) {
                throw new AuthError('Invalid refresh token');
            }

            const userJwtInfo = new UserJwtInfo(user.role, user.id, decoded.deviceId);
            const newAccessToken = tokenService.generateAccessToken(userJwtInfo);
            const newRefreshToken = tokenService.generateRefreshToken(userJwtInfo);

            await userService.updateRefreshToken(
                user.id,
                refreshToken,
                newRefreshToken,
                decoded.deviceId
            );

            res.json({
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            });
        } catch (error) {
            handleRouteError(error, res);
        }
    });

    return router;
}

function handleRouteError(error: unknown, res: Response): void {
    if (error instanceof AuthError) {
        res.status(error.status).json({ error: error.message });
    } else {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}