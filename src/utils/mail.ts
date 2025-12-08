import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

export const sendAnalyticsMail = async ({
    to,
    subject,
    html,
}: {
    to: string[];
    subject: string;
    html: string;
}) => {
    const info = await transporter.sendMail({
        from: `"Session Analytics" <${process.env.MAIL_USER}>`,
        to: to.join(', '),
        subject,
        html,
    });

    console.log("Message sent: %s", info.messageId);
};

export async function sendMail(to: string, subject: string, html: string) {
    await transporter.sendMail({
        from: `<${process.env.MAIL_USER}>`,
        to,
        subject,
        html,
    });
}
