import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const required = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "HAYDEN_GOOGLE_EMAIL",
  "CONSTANCE_GOOGLE_EMAIL",
];

const optional = ["RESEND_API_KEY", "EMAIL_FROM", "APP_BASE_URL"];
const recommended = ["FAMILY_NAME"];

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function hasValue(key: string) {
  return Boolean(process.env[key]?.trim());
}

function assertUrl(key: string) {
  const value = process.env[key];
  if (!value) return null;

  try {
    new URL(value);
    return null;
  } catch {
    return `${key} must be a valid URL.`;
  }
}

function usesPublicEmailProvider(value: string | undefined) {
  return /@(gmail|outlook|hotmail|yahoo|icloud)\./i.test(value ?? "");
}

function main() {
  loadDotEnv();

  const missing = required.filter((key) => !hasValue(key));
  const warnings = optional
    .filter((key) => !hasValue(key))
    .map((key) => `${key} is not configured.`);
  warnings.push(
    ...recommended
      .filter((key) => !hasValue(key))
      .map((key) => `${key} is not configured; default value will be used.`),
  );
  if (usesPublicEmailProvider(process.env.EMAIL_FROM)) {
    warnings.push(
      "EMAIL_FROM appears to use a public email provider. Resend normally requires a verified sending domain.",
    );
  }
  const errors = [
    ...missing.map((key) => `${key} is required.`),
    assertUrl("NEXTAUTH_URL"),
    hasValue("APP_BASE_URL") ? assertUrl("APP_BASE_URL") : null,
  ].filter(Boolean);

  if (errors.length > 0) {
    console.error("Environment check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Environment check passed.");

  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
}

main();
