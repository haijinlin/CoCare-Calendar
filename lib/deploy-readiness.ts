import { prisma } from "@/lib/prisma";

export type ReadinessStatus = "ok" | "warning" | "error";

export type ReadinessCheck = {
  key: string;
  label: string;
  status: ReadinessStatus;
  message: string;
};

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

function isLocalUrl(value: string | undefined) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(value?.trim() ?? "");
}

function isHttpsUrl(value: string | undefined) {
  return /^https:\/\//i.test(value?.trim() ?? "");
}

function checkRequiredEnv(key: string, label: string): ReadinessCheck {
  return configured(process.env[key])
    ? { key, label, status: "ok", message: "Configured" }
    : { key, label, status: "error", message: `${key} is missing.` };
}

function checkEmail(key: string, label: string): ReadinessCheck {
  const value = process.env[key]?.trim();

  if (!value) {
    return { key, label, status: "error", message: `${key} is missing.` };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { key, label, status: "warning", message: "Configured, but it does not look like a valid email." };
  }

  return { key, label, status: "ok", message: "Configured" };
}

function checkUrl(key: string, label: string, { requireHttps }: { requireHttps: boolean }): ReadinessCheck {
  const value = process.env[key]?.trim();

  if (!value) {
    return { key, label, status: "error", message: `${key} is missing.` };
  }

  try {
    new URL(value);
  } catch {
    return { key, label, status: "error", message: `${key} is not a valid URL.` };
  }

  if (requireHttps && !isHttpsUrl(value)) {
    return { key, label, status: "warning", message: "Use an https:// production URL before deploy." };
  }

  if (isLocalUrl(value) && process.env.NODE_ENV === "production") {
    return { key, label, status: "warning", message: "Still points to localhost in production." };
  }

  return { key, label, status: "ok", message: value };
}

function checkEmailFrom(): ReadinessCheck {
  const value = process.env.EMAIL_FROM?.trim();

  if (!value) {
    return { key: "EMAIL_FROM", label: "Email sender", status: "warning", message: "Missing. Emails may be skipped or rejected." };
  }

  if (/@(gmail|outlook|hotmail|yahoo|icloud)\./i.test(value)) {
    return {
      key: "EMAIL_FROM",
      label: "Email sender",
      status: "warning",
      message: "Uses a public email domain. Resend usually needs a verified sender domain.",
    };
  }

  return { key: "EMAIL_FROM", label: "Email sender", status: "ok", message: "Configured" };
}

function rollup(checks: ReadinessCheck[]): ReadinessStatus {
  if (checks.some((check) => check.status === "error")) return "error";
  if (checks.some((check) => check.status === "warning")) return "warning";
  return "ok";
}

export async function getDeployReadiness() {
  const checks: ReadinessCheck[] = [
    checkRequiredEnv("DATABASE_URL", "Database URL"),
    checkRequiredEnv("NEXTAUTH_SECRET", "NextAuth secret"),
    checkUrl("NEXTAUTH_URL", "NextAuth URL", { requireHttps: process.env.NODE_ENV === "production" }),
    checkRequiredEnv("GOOGLE_CLIENT_ID", "Google OAuth client ID"),
    checkRequiredEnv("GOOGLE_CLIENT_SECRET", "Google OAuth client secret"),
    checkEmail("HAYDEN_GOOGLE_EMAIL", "Hayden Google email"),
    checkEmail("CONSTANCE_GOOGLE_EMAIL", "Constance Google email"),
    checkRequiredEnv("RESEND_API_KEY", "Resend API key"),
    checkEmailFrom(),
    checkUrl("APP_BASE_URL", "App base URL", { requireHttps: process.env.NODE_ENV === "production" }),
  ];

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({
      key: "DATABASE_CONNECTION",
      label: "Database connection",
      status: "ok",
      message: "Connected",
    });
  } catch {
    checks.push({
      key: "DATABASE_CONNECTION",
      label: "Database connection",
      status: "error",
      message: "Could not connect to the database.",
    });
  }

  return {
    ok: !checks.some((check) => check.status === "error"),
    status: rollup(checks),
    timestamp: new Date().toISOString(),
    checks,
  };
}
