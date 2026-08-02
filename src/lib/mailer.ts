import { Resend } from "resend";

const FROM = process.env.RESEND_EMAIL_FROM || "Finarthax <onboarding@resend.dev>";

let client: Resend | null = null;

export const isMailerConfigured = (): boolean => !!process.env.RESEND_API_KEY;

const getClient = (): Resend => {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
};

export const appUrl = (): string => (process.env.NODE_ENV === "development" ? "http://localhost:3000" : (process.env.NEXTAUTH_URL ?? ""));

export interface EmailRow {
  label: string;
  value: string;
  emphasis?: "positive" | "negative" | "neutral";
}

export interface EmailContent {
  heading: string;
  greeting?: string;
  intro?: string;
  rows?: EmailRow[];
  bullets?: string[];
  cta?: { label: string; url: string };
  note?: string;
  manageLabel?: string;
}

const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const EMPHASIS_COLOR = {
  positive: "#10b981",
  negative: "#ef4444",
  neutral: "#1b3c53",
} as const;

export const renderEmail = (content: EmailContent): string => {
  const rows = (content.rows ?? [])
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">${escapeHtml(row.label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:${EMPHASIS_COLOR[row.emphasis ?? "neutral"]};font-size:14px;font-weight:600;text-align:right;">${escapeHtml(row.value)}</td>
        </tr>`,
    )
    .join("");

  const bullets = (content.bullets ?? []).map((item) => `<li style="margin:0 0 8px 0;color:#374151;font-size:14px;">${escapeHtml(item)}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="width:100%;background-color:#f3f4f6;padding:40px 20px;">
    <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <div style="background:linear-gradient(135deg,#1b3c53 0%,#234c6a 100%);padding:32px 30px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">${escapeHtml(content.heading)}</h1>
      </div>

      <div style="padding:32px 30px;color:#374151;font-size:16px;line-height:1.6;">
        ${content.greeting ? `<p style="margin:0 0 16px 0;">${escapeHtml(content.greeting)}</p>` : ""}
        ${content.intro ? `<p style="margin:0 0 20px 0;">${escapeHtml(content.intro)}</p>` : ""}
        ${rows ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px 0;">${rows}</table>` : ""}
        ${bullets ? `<ul style="margin:0 0 20px 0;padding-left:20px;">${bullets}</ul>` : ""}
        ${
          content.cta
            ? `<div style="text-align:center;margin:28px 0;">
                 <a href="${content.cta.url}" style="display:inline-block;background:linear-gradient(135deg,#1b3c53 0%,#234c6a 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">${escapeHtml(content.cta.label)}</a>
               </div>`
            : ""
        }
      </div>

      <div style="background-color:#f9fafb;padding:24px 30px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 8px 0;color:#6b7280;font-size:14px;font-weight:600;">Finarthax</p>
        ${content.note ? `<p style="margin:0 0 8px 0;color:#9ca3af;font-size:12px;">${escapeHtml(content.note)}</p>` : ""}
        ${content.manageLabel ? `<a href="${appUrl()}/admin/dashboard/settings" style="color:#234c6a;text-decoration:none;font-size:12px;">${escapeHtml(content.manageLabel)}</a>` : ""}
      </div>
    </div>
  </div>
</body>
</html>`;
};

export const sendEmail = async ({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> => {
  if (!isMailerConfigured()) throw new Error("Email is not configured");

  const { error } = await getClient().emails.send({ from: FROM, to, subject, html });

  if (error) throw new Error(error.message || "Failed to send email");
};
