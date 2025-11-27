import nodemailer from "nodemailer";
import { google } from "googleapis";

const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN!;
const USER_EMAIL = process.env.USER_EMAIL!;

const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

oAuth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN,
});

async function createTransporter() {
    const accessToken = await oAuth2Client.getAccessToken();

    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            type: "OAuth2",
            user: USER_EMAIL,
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
            refreshToken: REFRESH_TOKEN,
            accessToken: accessToken.token,
        },
    });
}

export const sendAnalyticsMail = async ({
    to,
    subject,
    html,
}: {
    to: string[];
    subject: string;
    html: string;
}) => {
    const transporter = await createTransporter();

    const info = await transporter.sendMail({
        from: `"Session Analytics" <${USER_EMAIL}>`,
        to: to.join(", "),
        subject,
        html,
    });

    console.log("Message sent:", info.messageId);
};

export async function sendMail(to: string, subject: string, text: string) {
    const transporter = await createTransporter();

    const info = await transporter.sendMail({
        from: `<${USER_EMAIL}>`,
        to,
        subject,
        text,
    });

    console.log("Message sent:", info.messageId);
}
