import { NextRequest } from "next/server";
import { prisma, withMaintenanceGuard } from "@/lib";
import nodemailer from "nodemailer";
import { errorResponse, successResponse, validationErrorResponse } from "@/utils";
import z from "zod";
import { forgotPasswordSchema } from "@/types";
import crypto from "crypto";

const url = process.env.NODE_ENV === "development" ? "http://localhost:3000" : process.env.NEXTAUTH_URL;

const generatePasswordResetEmail = (resetUrl: string): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f3f4f6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-wrapper {
      width: 100%;
      background-color: #f3f4f6;
      padding: 40px 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .email-header {
      background: linear-gradient(135deg, #1b3c53 0%, #234c6a 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .email-header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
    }
    .email-body {
      padding: 40px 30px;
    }
    .email-content {
      color: #374151;
      font-size: 16px;
      line-height: 1.6;
    }
    .email-content h2 {
      color: #1b3c53;
      font-size: 22px;
      font-weight: 600;
      margin: 0 0 16px 0;
    }
    .email-content p {
      margin: 0 0 16px 0;
    }
    .reset-button {
      display: inline-block;
      background: linear-gradient(135deg, #1b3c53 0%, #234c6a 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      text-align: center;
    }
    .button-wrapper {
      text-align: center;
    }
    .info-box {
      background-color: #f3f4f6;
      border-left: 4px solid #234c6a;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 0;
      color: #4b5563;
      font-size: 14px;
    }
    .alternative-link {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin: 24px 0;
      word-break: break-all;
    }
    .alternative-link p {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: #6b7280;
      font-weight: 600;
    }
    .alternative-link a {
      color: #234c6a;
      text-decoration: none;
      font-size: 13px;
    }
    .email-footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .email-footer p {
      margin: 0 0 8px 0;
      color: #6b7280;
      font-size: 14px;
    }
    .email-footer a {
      color: #234c6a;
      text-decoration: none;
    }
    .divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 24px 0;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 20px 10px;
      }
      .email-header {
        padding: 30px 20px;
      }
      .email-header h1 {
        font-size: 24px;
      }
      .email-body {
        padding: 30px 20px;
      }
      .email-content h2 {
        font-size: 20px;
      }
      .reset-button {
        display: block;
        width: 100%;
        box-sizing: border-box;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <!-- Header -->
      <div class="email-header">
        <h1>🔐 Finarthax</h1>
      </div>

      <!-- Body -->
      <div class="email-body">
        <div class="email-content">
          <h2>Reset Your Password</h2>
          <p>Hello,</p>
          <p>We received a request to reset the password for your Finance Manager account. If you didn't make this request, you can safely ignore this email.</p>
          
          <div class="button-wrapper">
            <a href="${resetUrl}" class="reset-button">Reset Password</a>
          </div>

          <div class="info-box">
            <p><strong>⏰ This link will expire in 1 hour</strong></p>
            <p>For your security, this password reset link is only valid for 60 minutes.</p>
          </div>

          <div class="alternative-link">
            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
            <a href="${resetUrl}">${resetUrl}</a>
          </div>

          <div class="divider"></div>

          <p style="font-size: 14px; color: #6b7280;">
            <strong>Why did I receive this email?</strong><br>
            This email was sent because someone requested a password reset for an account associated with this email address. If you didn't request this, please ignore this email or contact our support team if you have concerns.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="email-footer">
        <p><strong>Finarthax</strong></p>
        <p>Making personal finance management simple and secure.</p>
        
        <div class="divider" style="margin: 16px auto; max-width: 200px;"></div>
        
        <p style="font-size: 12px; color: #9ca3af;">
          If you have any questions, please contact us at 
          <a href="mailto:support@financemanager.com">support@financemanager.com</a>
        </p>
        
        <p style="font-size: 12px; color: #9ca3af; margin-top: 16px;">
          © 2025 Finance Manager. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
};

const sendEmail = async ({ to, subject, html }: { to: string; subject: string; html: string }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({ from: `"Finarthax" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`, to, subject, html });
};

export async function POST(req: NextRequest) {
  return withMaintenanceGuard(req, async () => {
    try {
      const body = await req.json();
      const validation = forgotPasswordSchema.safeParse(body);

      if (!validation.success) {
        const { fieldErrors } = z.flattenError(validation.error);
        return validationErrorResponse(fieldErrors);
      }

      const { email } = validation.data;

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) return errorResponse("No account found for this email. Please sign up first.", 404);

      if (!user.password) return errorResponse("This account is registered via Google. Please sign in with Google.", 400);

      const resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
      const expires = new Date(Date.now() + 3600000);

      await prisma.verificationToken.create({ data: { identifier: email, token: hashedToken, expires } });

      const resetUrl = `${url}/reset-password?token=${resetToken}`;

      await sendEmail({
        to: email,
        subject: "Reset Your Password - Finance Manager",
        html: generatePasswordResetEmail(resetUrl),
      });

      return successResponse(null, "If the email exists, a reset link has been sent");
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      return errorResponse(errorMessage, 500);
    }
  });
}
