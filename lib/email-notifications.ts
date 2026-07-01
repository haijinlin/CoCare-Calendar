type EmailPayload = {
  to: string;
  subject: string;
  text: string;
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

export async function sendNotificationEmail({ to, subject, text }: EmailPayload): Promise<EmailResult> {
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
