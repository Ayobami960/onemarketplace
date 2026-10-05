import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

interface EmailMessage {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

export const buildOtpEmailHtml = ({
    firstName,
    code,
    expiryMinutes,
    purpose,
}: {
    firstName: string;
    code: string;
    expiryMinutes: number;
    purpose: "email_verification" | "password_reset";
}): string => {
    const greetingName = escapeHtml(firstName || "there");
    const safeCode = escapeHtml(code);
    const isVerification = purpose === "email_verification";
    const title = isVerification ? "Verify your email" : "Reset your password";
    const description = isVerification
        ? "Use the code below to complete your sign-up and protect your account."
        : "Use the code below to reset your OneMarketplace password.";
    const codeLabel = isVerification ? "Verification code" : "Password reset code";
    const preheader = isVerification ? "Your verification code" : "Your password reset code";

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light only" />
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
    <title>${title}</title>
  </head>
  <body style="margin:0; padding:0; background:#f4f6f2; font-family:Arial, Helvetica, sans-serif; color:#252724;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
      ${preheader} is ${safeCode}. This code expires in ${expiryMinutes} minutes.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f2; width:100%; margin:0; padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; margin:0 auto; background:#ffffff; border:1px solid #e3e8e0; border-radius:16px; overflow:hidden;">
            <tr>
              <td style="background:#252724; padding:24px 32px; text-align:left;">
                <div style="font-size:12px; letter-spacing:2px; color:#dfe7dc; text-transform:uppercase; font-weight:700;">OneMarketplace</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 20px;">
                <p style="margin:0; font-size:14px; line-height:22px; color:#5c625b;">Hello ${greetingName},</p>
                <h1 style="margin:20px 0 12px; font-size:28px; line-height:36px; color:#252724; font-weight:700;">${title}</h1>
                <p style="margin:0; font-size:15px; line-height:24px; color:#5d625b;">${description}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f2; border:1px solid #e3e8e0; border-radius:12px;">
                  <tr>
                    <td align="center" style="padding:20px 16px;">
                      <div style="font-size:12px; letter-spacing:2px; color:#62805f; text-transform:uppercase; font-weight:700;">${codeLabel}</div>
                      <div style="margin-top:12px; font-size:36px; line-height:42px; letter-spacing:8px; font-family:Consolas, 'Courier New', monospace; color:#252724; font-weight:700;">${safeCode}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px;">
                <p style="margin:0; font-size:14px; line-height:22px; color:#5b5f5a;">This code expires in ${expiryMinutes} minutes.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;">
                <p style="margin:0; padding:12px 14px; border-radius:10px; background:#edf3ea; color:#4f704a; font-size:12px; line-height:20px; border:1px solid #dfeadf;">
                  Never share this code with anyone. Keep it private and do not send it to support teams.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px;">
                <p style="margin:0; font-size:12px; line-height:20px; color:#748078;">
                  If you did not request this code, you can ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px; border-top:1px solid #e3e8e0;">
                <p style="margin:16px 0 0; font-size:12px; line-height:18px; color:#7a817b;">OneMarketplace</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

type SmtpTransporter = ReturnType<typeof nodemailer.createTransport>;

let transporter: SmtpTransporter | undefined;
let transporterVerification: Promise<void> | undefined;

const getSmtpConfig = () => {
    const { host, port, secure, user, pass, from } = env.smtp;
    const missing = [
        ["SMTP_HOST", host],
        ["SMTP_PORT", port],
        ["SMTP_SECURE", secure],
        ["SMTP_USER", user],
        ["SMTP_PASS", pass],
        ["SMTP_FROM", from],
    ].filter(([, value]) => value === undefined || value === "").map(([name]) => name);

    if (missing.length) {
        throw new Error(`Email delivery is not configured. Set ${missing.join(", ")}.`);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user!) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from!)) {
        throw new Error("SMTP_USER and SMTP_FROM must be valid email addresses.");
    }

    return { host: host!, port: port!, secure: secure!, user: user!, pass: pass!, from: from! };
};

export const verifyMailer = async (): Promise<void> => {
    if (!transporterVerification) {
        transporterVerification = (async () => {
            const config = getSmtpConfig();
            transporter = nodemailer.createTransport({
                host: config.host,
                port: config.port,
                secure: config.secure,
                auth: { user: config.user, pass: config.pass },
            });
            await transporter.verify();
        })();
    }

    try {
        await transporterVerification;
    } catch (error) {
        transporterVerification = undefined;
        transporter = undefined;
        const reason = error instanceof Error ? error.message : "Unknown SMTP error.";
        console.error("SMTP transporter verification failed.", error);
        throw new ApiError(502, `SMTP transporter verification failed: ${reason}`);
    }
};

export const sendEmail = async ({ to, subject, text, html }: EmailMessage): Promise<void> => {
    try {
        await verifyMailer();
        if (!transporter) throw new Error("SMTP transporter is unavailable.");
        const { from } = getSmtpConfig();
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            text,
            ...(html ? { html } : {}),
        });

        if (!info.accepted || info.accepted.length === 0) {
            throw new Error("The SMTP provider did not accept the recipient.");
        }
    } catch (error) {
        console.error("SMTP email delivery failed.", error);
        const reason = error instanceof Error ? error.message : "Unknown SMTP error.";
        throw new Error(`Email delivery failed: ${reason}`);
    }
};