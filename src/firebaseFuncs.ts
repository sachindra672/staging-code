export async function sendChunkedNotifications(
    title: string,
    body: string,
    tokens: string[],
    chunkSize: number = 500
): Promise<void> {
    try {
        await fetch('http://127.0.0.1:6666/notifications/send-chunked', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title, body, tokens, chunkSize
            })
        })
    } catch (error) {
        console.log(error)
    }
}

export async function sendIndividualNotification(title: string, message: string, deviceId: string) {
    try {
        await fetch('http://127.0.0.1:6666/notifications/send-individual', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title,
                body: message,
                token: deviceId
            }),
        })
    } catch (error) {
        console.log(error)
    }
}