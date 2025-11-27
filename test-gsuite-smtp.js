import nodemailer from "nodemailer";
import { google } from "googleapis";
import "dotenv/config";

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const USER_EMAIL = process.env.USER_EMAIL;
const TEST_TO = process.env.TEST_TO || USER_EMAIL;

async function testOAuthSMTP() {
  console.log("🔐 Initializing OAuth2 client...");

  const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

  try {
    console.log("🔑 Generating access token...");
    const accessToken = await oAuth2Client.getAccessToken();
    if (!accessToken.token) throw new Error("Failed to get access token");

    console.log("📡 Creating transporter...");
    const transporter = nodemailer.createTransport({
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

    console.log("🧪 Verifying OAuth2 SMTP connection...");
    await transporter.verify();
    console.log("✅ OAuth2 SMTP connection successful!");

    console.log("📨 Sending test email...");
    const info = await transporter.sendMail({
      from: `"OAuth2 Test" <${USER_EMAIL}>`,
      to: TEST_TO,
      subject: "OAuth2 SMTP Test Email ✔",
      html: `
        <h2>OAuth2 Email Test Successful 🎉</h2>
        <p>This email was sent using Gmail OAuth2 without an app password.</p>
        <img src="https://media.tenor.com/B_JetO57I3IAAAAM/test-homer-simpson.gif" />
      `,
    });

    console.log("📧 Email sent successfully:", info.messageId);
  } catch (err) {
    console.error("❌ OAuth2 SMTP failed:", err.message);
    console.error(err);
  }
}

testOAuthSMTP();
