import { redis } from '../misc';

export const getCache = async (key: string) => {
    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error(`[Redis:getCache] Error for key "${key}":`, err);
        return null;
    }
};

export const setCache = async (key: string, data: any, ttl = 60) => {
    try {
        const json = JSON.stringify(data);
        if (ttl > 0) {
            await redis.setex(key, ttl, json);
        } else {
            await redis.set(key, json);
        }
    } catch (err) {
        console.error(`[Redis:setCache] Error for key "${key}":`, err);
    }
};


export const invalidateCache = async (pattern: string) => {
    try {
        let cursor = '0';
        const keysToDelete: string[] = [];

        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length) keysToDelete.push(...keys);
        } while (cursor !== '0');

        if (keysToDelete.length > 0) {
            await redis.del(keysToDelete);
            console.log(`[Redis:invalidateCache] Cleared ${keysToDelete.length} keys for pattern "${pattern}"`);
        }
    } catch (err) {
        console.error(`[Redis:invalidateCache] Error for pattern "${pattern}":`, err);
    }
};
