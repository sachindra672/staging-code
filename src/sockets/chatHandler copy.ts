import fs from 'fs';
import path from 'path';
import { Server, Socket } from 'socket.io';

type ChatVisibilityMode = 'public' | 'student-to-teacher';

interface ChatSettings {
    slowModeInterval: number;
    lastMessageTimestamps: Map<string, number>;
    mutedUsers: Map<string, number>;
    isGlobalMute: boolean;
    teacherBannedWords: string[];
    chatMode: ChatVisibilityMode;
    banViolationCount: Map<string, number>;
}

// Load predefined banned words once
const predefinedBannedWords: string[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../config/bannedWords.json'), 'utf-8')
);

const sessionChatSettings = new Map<string, ChatSettings>();
const AUTO_MUTE_THRESHOLD = 3;
const AUTO_MUTE_DURATION_SEC = 300;

export const setupChatHandlers = (io: Server, socket: Socket, sessionId: string) => {
    const user = (socket as any).user;
    if (!user) {
        console.log(`User not found for socket ${socket.id}`);
        return;
    }

    if (!sessionChatSettings.has(sessionId)) {
        console.log(`Initializing chat settings for session ${sessionId}`);
        sessionChatSettings.set(sessionId, {
            slowModeInterval: 0,
            lastMessageTimestamps: new Map(),
            mutedUsers: new Map(),
            isGlobalMute: false,
            teacherBannedWords: [],
            chatMode: 'public',
            banViolationCount: new Map(),
        });
    }

    const settings = sessionChatSettings.get(sessionId)!;

    socket.on('chat-message', (message: string) => {
        console.log(`Chat message from ${user.info.email}: ${message}`);
        console.log(`Chat settings for session ${sessionId}:`, settings);
        const now = Date.now();
        const userId = user.info.uuid;

        if (settings.isGlobalMute && user.role !== 'mentor') {
            console.log(`Global chat is muted. User ${user.info.email} cannot send messages.`);
            return socket.emit('chat-error', 'Chat is globally muted.');
        }

        const muteUntil = settings.mutedUsers.get(userId);
        if (muteUntil && now < muteUntil) {
            console.log(`User ${user.info.email} is muted until ${new Date(muteUntil).toLocaleTimeString()}`);
            return socket.emit('chat-error', 'You are muted.');
        }

        if (settings.slowModeInterval > 0) {
            console.log(`User ${user.info.email} is in slow mode.`);
            const lastSent = settings.lastMessageTimestamps.get(userId) || 0;
            if (now - lastSent < settings.slowModeInterval * 1000) {
                console.log(`User ${user.info.email} is trying to send a message too soon.`);
                return socket.emit('chat-error', `Slow mode: wait ${Math.ceil((settings.slowModeInterval * 1000 - (now - lastSent)) / 1000)}s.`);
            }
            settings.lastMessageTimestamps.set(userId, now);
        }

        const lowerMsg = message.toLowerCase();
        const allBannedWords = [...predefinedBannedWords, ...settings.teacherBannedWords];
        const wordsInMessage = lowerMsg
            .replace(/[^\w\s]/g, '')
            .split(/\s+/);

        const matchedWord = allBannedWords.find(
            (banned) => wordsInMessage.includes(banned.toLowerCase())
        );

        if (matchedWord) {
            console.log(`User ${user.info.email} used a banned word: ${matchedWord}`);
            const count = (settings.banViolationCount.get(userId) || 0) + 1;
            settings.banViolationCount.set(userId, count);

            if (count >= AUTO_MUTE_THRESHOLD) {
                console.log(`User ${user.info.email} has been auto-muted for using banned words too many times.`);
                const muteUntil = now + AUTO_MUTE_DURATION_SEC * 1000;
                settings.mutedUsers.set(userId, muteUntil);
                settings.banViolationCount.set(userId, 0); // Reset count after mute

                console.log(`User ${user.info.email} has been auto-muted for using banned words too many times.`);
                socket.emit('chat-error', `You used banned words too many times. Muted for ${AUTO_MUTE_DURATION_SEC / 60} minutes.`);
                return;
            }

            socket.emit('chat-warning', `Warning: Inappropriate language detected (${count}/3). Avoid such words.`);
            return;
        }

        const msgPayload = {
            userId,
            name: user.info.email,
            message,
            timestamp: now,
        };

        if (settings.chatMode === 'public') {
            console.log(`Broadcasting message to session ${sessionId}`);
            io.to(sessionId).emit('chat-message', msgPayload);
        } else if (settings.chatMode === 'student-to-teacher') {
            if (user.role === 'mentor') {
                console.log(`Teacher ${user.info.email} received a private message in session ${sessionId}`);
                io.to(sessionId).emit('chat-message', msgPayload);
            } else {
                const teacherSockets = Array.from(io.sockets.sockets.values()).filter(
                    (s) =>
                        (s as any)?.user?.role === 'mentor' && s.rooms.has(sessionId)
                );
                console.log(`Private message from ${user.info.email} to teachers in session ${sessionId}`, JSON.stringify(teacherSockets));
                teacherSockets.forEach((s) => {
                    s.emit('chat-message', { ...msgPayload, private: true });
                });
                console.log(`Private message sent to ${teacherSockets.length} teachers.`);
                socket.emit('chat-message', { ...msgPayload, private: true });
            }
        }

        console.log(`Message from ${user.info.email} in session ${sessionId}:`, message);
    });

    // Reaction Handling (global for now can be restrict to teacher)
    socket.on('reaction', ({ emoji }: { emoji: string }) => {
        const now = Date.now();
        const userId = user.info.uuid;

        const lastReactionTime = settings.lastMessageTimestamps.get(userId) || 0;
        if (now - lastReactionTime < 1000) {
            return socket.emit('reaction-error', 'Too many reactions too quickly.');
        }

        settings.lastMessageTimestamps.set(userId, now);

        const payload = {
            userId,
            name: user.info.email,
            emoji,
            timestamp: now,
        };

        io.to(sessionId).emit('reaction', payload);
    });

    // Teacher Controls

    socket.on('set-ban-words', ({ words }: { words: string[] }) => {
        if (user.role !== 'mentor') return;
        settings.teacherBannedWords = words;
        socket.emit('ban-words-updated', words);
    });

    socket.on('set-slow-mode', ({ interval }: { interval: number }) => {
        if (user.role !== 'mentor') return;
        settings.slowModeInterval = interval;
        io.to(sessionId).emit('slow-mode-updated', interval);
    });

    socket.on('mute-user', ({ userId, duration }: { userId: string; duration: number }) => {
        if (user.role !== 'mentor') return;
        const muteUntil = Date.now() + duration * 1000;
        settings.mutedUsers.set(userId, muteUntil);
        socket.emit('user-muted', { userId, until: muteUntil });
    });

    socket.on('unmute-user', ({ userId }: { userId: string }) => {
        if (user.role !== 'mentor') return;
        settings.mutedUsers.delete(userId);
        socket.emit('user-unmuted', { userId });
    });

    socket.on('set-global-mute', ({ muted }: { muted: boolean }) => {
        console.log(`Setting global mute to ${muted} by ${user.info.email} in session ${sessionId} with role ${user.role}`);
        if (user.role !== 'mentor') return;
        settings.isGlobalMute = muted;
        io.to(sessionId).emit('global-mute-updated', muted);
    });

    socket.on('set-chat-mode', ({ mode }: { mode: ChatVisibilityMode }) => {
        if (user.role !== 'mentor') return;
        settings.chatMode = mode;
        io.to(sessionId).emit('chat-mode-updated', mode);
    });
};
