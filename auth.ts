import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

function normalized(value: string | undefined) {
  return value?.trim().toLowerCase() || "";
}

export function allowedGoogleEmails() {
  return [
    normalized(process.env.HAYDEN_GOOGLE_EMAIL),
    normalized(process.env.CONSTANCE_GOOGLE_EMAIL),
  ].filter(Boolean);
}

function maskedEmail(email: string) {
  const [name, domain] = email.split("@");

  if (!name || !domain) return "";

  return `${name.slice(0, 2)}***@${domain}`;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const email = normalized(user.email ?? undefined);

      if (email.length > 0 && allowedGoogleEmails().includes(email)) {
        return true;
      }

      const hint = maskedEmail(email);

      return `/login?error=not-allowed${hint ? `&email=${encodeURIComponent(hint)}` : ""}`;
    },
  },
};
