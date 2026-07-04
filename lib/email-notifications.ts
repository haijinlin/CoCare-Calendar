type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type EmailResult =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

function appBaseUrl() {
  return process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
}

function fromAddress() {
  return process.env.EMAIL_FROM || "Care Calendar <notifications@care-calendar.local>";
}

export function notificationEmailForRole(role: string) {
  if (role === "PARENT_A") return process.env.HAYDEN_GOOGLE_EMAIL?.trim() || null;
  if (role === "PARENT_B") return process.env.CONSTANCE_GOOGLE_EMAIL?.trim() || null;
  return null;
}

export function calendarUrl(path = "/") {
  return new URL(path, appBaseUrl()).toString();
}

export function emailNotificationsConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainTextToHtml(text: string, subject: string) {
  const lines = text.split("\n");
  const intro = lines.find((line) => line.trim())?.trim() ?? subject;
  const urlLine = [...lines].reverse().find((line) => /^https?:\/\//.test(line.trim()) || line.includes("http"));
  const urlMatch = urlLine?.match(/https?:\/\/\S+/);
  const actionUrl = urlMatch?.[0];
  const details = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== intro)
    .filter((line) => !line.includes("Open this") && !line.includes("Open the"))
    .filter((line) => !/^https?:\/\//.test(line));

  const detailRows = details
    .map((line) => {
      const separatorIndex = line.indexOf(":");

      if (separatorIndex > 0 && separatorIndex < 32) {
        const label = line.slice(0, separatorIndex);
        const value = line.slice(separatorIndex + 1).trim();

        return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;width:34%;vertical-align:top;">${escapeHtml(label)}</td>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
          </tr>`;
      }

      return `
        <tr>
          <td colspan="2" style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#334155;font-size:14px;line-height:1.5;">${escapeHtml(line)}</td>
        </tr>`;
    })
    .join("");

  const cta = actionUrl
    ? `
      <div style="margin-top:24px;">
        <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#020617;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:8px;">Open CoCare</a>
      </div>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:22px 24px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;">
                <div style="font-size:13px;color:#475569;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">CoCare Calendar</div>
                <div style="font-size:22px;line-height:1.25;color:#020617;font-weight:800;margin-top:6px;">${escapeHtml(subject)}</div>
                <div style="font-size:13px;color:#64748b;margin-top:4px;">Derick's care calendar</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <div style="font-size:16px;line-height:1.55;color:#0f172a;font-weight:600;">${escapeHtml(intro)}</div>
                ${detailRows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border-collapse:collapse;">${detailRows}</table>` : ""}
                ${cta}
                <div style="margin-top:24px;padding-top:18px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5;">
                  This email is a notification only. Please keep replies and records inside CoCare.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendNotificationEmail({ to, subject, text, html }: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || !to) {
    console.info(`[email skipped] ${subject} -> ${to || "missing recipient"}`);
    return {
      status: "skipped",
      reason: !apiKey ? "RESEND_API_KEY is not configured." : "Recipient email is missing.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to,
        subject,
        text,
        html: html ?? plainTextToHtml(text, subject),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`[email failed] ${response.status} ${detail}`);
      return {
        status: "failed",
        reason: `Resend returned ${response.status}: ${detail.slice(0, 240)}`,
      };
    }

    return { status: "sent" };
  } catch (error) {
    console.error("[email failed]", error);
    return { status: "failed", reason: "Email request failed." };
  }
}
