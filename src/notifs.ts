import { sendChunkedNotifications, sendIndividualNotification } from './firebaseFuncs'
import { prisma, uploadBanner2, uploadNotifImage } from './misc'
import e, { Request, Response } from 'express'

enum notificationsClients {
    endUsers,
    parents,
    staff
}

const maxLength = 4096;

function resizeMessage(message: string, title: string) {
    if ((message.length + title.length) > maxLength) {
        const totalLength = message.length + title.length;
        const messageRatio = message.length / totalLength;
        const titleRatio = title.length / totalLength;

        message = message.slice(0, Math.floor((maxLength - 3) * messageRatio)).concat("...");
        title = title.slice(0, Math.floor((maxLength - 3) * titleRatio)).concat("...");
    }
}

export async function SendMessageNotificationToDeviceId(deviceId: string, message: string, title: string) {

    resizeMessage(message, title)
    await sendIndividualNotification(title, message, deviceId);
}

async function BroadcastHook(message: string, title: string) {
    const deviceIds = (await prisma.endUsers.findMany({ select: { deviceId: true } })).map(e => e.deviceId)


    if (deviceIds) {
        resizeMessage(message, title)
        sendChunkedNotifications(title, message, deviceIds)
    }
}

export async function PingCourseStudents(bigCourseId: number, title: string, message: string) {
    try {
        const deviceIds = (await prisma.mgSubsciption.findMany({ where: { bigCourseId }, include: { user: true } })).map(e => e.user.deviceId)

        sendChunkedNotifications(title, message, deviceIds)
    } catch (error) {
        console.log(error)
    }
}

export async function postDiscountAnnouncement(bigCourseId: number, title: string) {
    try {
        const course = await prisma.bigCourse.findFirstOrThrow({ where: { id: bigCourseId } });

        prisma.announcements.create({ data: { content: `discount available on ${course.id}` } })
            .then(() => BroadcastHook(`discount available on ${course.id}`, title))
            .catch(e => {
                console.error(`An error occurred while sending notification: ${e}`);
            });

    } catch (e) {
        console.error(`An error occurred while processing the course: ${e}`);
    }
}


export async function coursePurchaseNotification(endUsersId: number, message: number) {
    console.log("UNIMPLIMENTED", endUsersId, message)
}

export async function InsertNotif(targetId: string, userType: number, content: string) {
    await prisma.notifications.create({ data: { targetId, userType, content } })
}

async function readNotif(targetId: string, userType: number,) {
    return await prisma.notifications.findMany({ where: { targetId, userType } })
}

export async function GetUserNotifications(req: Request, res: Response) {
    try {
        const { targetId } = req.body
        const notifs = await readNotif(targetId, 1)
        res.json(notifs)
    } catch (error) {
        console.log(error)
        res.status(500).send("something went wrong")
    }
}

export async function GetParentNotifications(req: Request, res: Response) {
    try {
        const { targetId } = req.body
        const notifs = await readNotif(targetId, notificationsClients.parents)
        res.json(notifs)
    } catch (error) {
        console.log(error)
        res.status(500).send("somethign went wrong")
    }
}

export async function GetStaffNotifications(req: Request, res: Response) {
    try {
        const { targetId } = req.body
        const notifs = await readNotif(targetId, notificationsClients.staff)
        res.json(notifs)
    } catch (error) {
        console.log(error)
        res.status(500).send("somethign went wrong")
    }
}

interface imageData {
    content: string
    name: string
}
interface NotifData {
    title: string
    message: string
    imageData?: imageData
    tokens: string[]
    callData: any
}

export async function PassMultiNotifcation(req: Request, res: Response) {
    const { title, message, imageData, tokens, callData }: NotifData = req.body
    try {
        let imageUrl = ""
        if (imageData) {
            await uploadNotifImage(imageData.content, imageData.name, "notifs")
            imageUrl = `https://epilot.in/student/thumbs/notifs/${imageData.name.split(".")[0]}.jpg`
        }

        fetch("http://localhost:4000/notifications/send-chunked",
            {
                method: "POST",
                headers: {
                    "Content-type": "application/json"
                },
                body: JSON.stringify({ title, body: message, imageUrl, tokens, callData })
            }).then(e => e.text()).then(e => res.send(e))

        for (const token of tokens) {
            prisma.notifications.create({ data: { content: message, targetId: token, userType: 1 } }).then(e => {
                console.log("inserted", e)
            })
        }
    } catch (error) {
        res.send({ success: false, error })
    }
}

interface notification {
    title: string
    body: string
    imageUrl?: string
    imageData?: imageData
    catogery?: string
}

interface Message {
    data: any,
    notification: notification,
    tokens: string[],
    sendAt: string,
    selectedClasses?: any[],
    selectedStudents?: any[]
}



export async function InterceptAndPass(req: Request, res: Response) {
    const body: Message = req.body;

    try {
        console.log("intercept called");

        // Upload image if present
        if (body.notification?.imageData) {
            await uploadNotifImage(
                body.notification.imageData.content,
                body.notification.imageData.name,
                "notifs"
            );

            body.notification.imageUrl = `https://epilot.in/student/thumbs/notifs/${body.notification.imageData.name.split(".")[0]
                }.jpg`;

            delete body.notification.imageData;
        }

        const now = new Date();
        let sendAt: Date | null = null;
        let isScheduled = false;

        // Only parse sendAt if provided
        if (body.sendAt) {
            sendAt = new Date(body.sendAt);

            if (isNaN(sendAt.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid sendAt format. Provide a valid date string or omit it for immediate send."
                });
            }

            isScheduled = sendAt.getTime() > now.getTime();
        }

        const sendTo = body.data?.sendTo ?? "all";
        const selectedClasses = body.selectedClasses ?? [];
        const selectedStudents = body.selectedStudents ?? [];

        // Scheduled notifications
        if (isScheduled && sendAt) {
            console.log("Going to schedule notification...");

            await prisma.scheduledNotification.create({
                data: {
                    title: body.notification.title,
                    content: body.notification.body,
                    tokens: body.tokens,
                    sendAt,
                    recipientType: sendTo,
                    recipientDetails: {
                        classes: selectedClasses,
                        students: selectedStudents
                    },
                    userType: 1,
                    status: "pending",
                    createdOn: now,
                    targetId: ""
                }
            });

            console.log("Scheduled notification created.");
            return res.json({ success: true, scheduled: true });
        }

        // Immediate notifications
        if (Array.isArray(body.tokens) && body.tokens.length > 0) {
            const notificationPromises = body.tokens.map(token =>
                prisma.notifications.create({
                    data: {
                        content: body.notification.body,
                        targetId: token,
                        catogery: body.notification.catogery,
                        userType: 1
                    }
                }).then(result => {
                    console.log("Inserted:", result.id);
                }).catch(error => {
                    console.error("Insert error:", error);
                })
            );

            await Promise.all(notificationPromises);
        } else {
            console.warn("No tokens provided for immediate notification.");
        }

        // Forward message to local service
        const response = await fetch("http://127.0.0.1:4004/", {
            method: "POST",
            body: JSON.stringify({
                tokens: body.tokens,
                data: {
                    title: body.notification?.title ?? "",
                    body: body.notification?.body ?? "",
                    imageUrl: body.notification?.imageUrl ?? "",
                    category: body.data?.category ?? "",
                    sendTo: body.data?.sendTo ?? "all",
                    type: body.data.type,
                    // data: JSON.stringify(body.data),
                    teacherToken: body.data.teacherToken,
                    callId: body.data.callId,
                    roomId: body.data.roomId
                }
            }),
            // body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" }
        }).then(res => res.text());

        console.log("Notification body sent:", JSON.stringify(body));
        return res.send(response);

    } catch (error) {
        console.error("Error in InterceptAndPass:", error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : String(error)
        });
    }
}

export async function InterceptAndPass2(req: Request, res: Response) {
    const body: Message = req.body;

    try {
        console.log("intercept called");

        // Upload image if present
        if (body.notification?.imageData) {
            await uploadNotifImage(
                body.notification.imageData.content,
                body.notification.imageData.name,
                "notifs"
            );

            body.notification.imageUrl = `https://epilot.in/student/thumbs/notifs/${body.notification.imageData.name.split(".")[0]
                }.jpg`;

            delete body.notification.imageData;
        }

        const now = new Date();
        let sendAt: Date | null = null;
        let isScheduled = false;

        // Only parse sendAt if provided
        if (body.sendAt) {
            sendAt = new Date(body.sendAt);

            if (isNaN(sendAt.getTime())) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid sendAt format. Provide a valid date string or omit it for immediate send.",
                });
            }

            isScheduled = sendAt.getTime() > now.getTime();
        }

        const sendTo = body.data?.sendTo ?? "all";
        const selectedClasses = body.selectedClasses ?? [];
        const selectedStudents = body.selectedStudents ?? [];

        // Scheduled notifications
        if (isScheduled && sendAt) {
            console.log("Going to schedule notification...");

            await prisma.scheduledNotification.create({
                data: {
                    title: body.notification.title,
                    content: body.notification.body,
                    tokens: body.tokens,
                    sendAt,
                    recipientType: sendTo,
                    recipientDetails: {
                        classes: selectedClasses,
                        students: selectedStudents,
                    },
                    userType: 1,
                    status: "pending",
                    createdOn: now,
                    targetId: "",
                },
            });

            console.log("Scheduled notification created.");
            return res.json({ success: true, scheduled: true });
        }

        // Immediate notifications
        if (Array.isArray(body.tokens) && body.tokens.length > 0) {
            const notificationPromises = body.tokens.map((token) =>
                prisma.notifications
                    .create({
                        data: {
                            content: body.notification.body,
                            targetId: token,
                            catogery: body.notification.catogery,
                            userType: 1,
                        },
                    })
                    .then((result) => {
                        console.log("Inserted:", result.id);
                    })
                    .catch((error) => {
                        console.error("Insert error:", error);
                    })
            );

            await Promise.all(notificationPromises);
        } else {
            console.warn("No tokens provided for immediate notification.");
        }

        // Forward message to local service
        const response = await fetch("http://127.0.0.1:4004/", {
            method: "POST",
            body: JSON.stringify({
                tokens: body.tokens,
                data: {
                    type: body.data.type,
                    title: body.notification?.title ?? "",
                    body: body.notification?.body ?? "",
                    callerName: body.data?.callerName ?? "",
                    teacherToken: body.data?.teacherToken ?? "",
                    roomId: body.data?.roomId ?? "",
                    imageUrl: body.notification?.imageUrl ?? "",
                    category: body.data?.category ?? "",
                    sendTo: body.data?.sendTo ?? "all",
                },
                android: {
                    priority: "high",
                },
                apns: {
                    headers: {
                        "apns-priority": "10",
                        "apns-push-type": "alert",
                    },
                    payload: {
                        aps: {
                            "content-available": 1,
                            sound: "default",
                        },
                    },
                },
            }),
            headers: { "Content-Type": "application/json" },
        }).then((res) => res.text());

        console.log("Notification body sent:", JSON.stringify(body));
        return res.send(response);
    } catch (error) {
        console.error("Error in InterceptAndPass:", error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : String(error),
        });
    }
}


export async function getScheduledNotifs(_req: Request, res: Response) {
    try {
        const jobs = await prisma.scheduledNotification.findMany({
            orderBy: { sendAt: "asc" }
        });
        res.json({ success: true, data: jobs });
    } catch (err) {
        console.error(err)
        res.status(500).json({ success: false, message: "Server error" })
    }
}

export async function cancelScheduledNotifs(req: Request, res: Response) {
    const { id } = req.body;

    if (!id || isNaN(Number(id))) {
        return res.status(400).json({ success: false, message: "Invalid or missing ID" });
    }

    try {
        await prisma.scheduledNotification.update({
            where: { id: Number(id) },
            data: { status: "cancelled" }
        });

        res.json({ success: true });
    } catch (err) {
        console.error("Failed to cancel scheduled notification:", err);
        res.status(500).json({ success: false });
    }
}

export async function updateScheduledNotifs(req: Request, res: Response) {
    const { id, title, content, sendAt } = req.body;

    if (!id || isNaN(Number(id))) {
        return res.status(400).json({ success: false, message: "Invalid or missing ID" });
    }

    try {
        await prisma.scheduledNotification.update({
            where: { id: Number(id) },
            data: {
                title,
                content,
                sendAt: new Date(sendAt),
                status: "pending"
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error("Failed to update scheduled notification:", err);
        res.status(500).json({ success: false });
    }
}