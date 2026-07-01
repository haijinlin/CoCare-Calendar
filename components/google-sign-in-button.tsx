"use client";

import { signIn } from "next-auth/react";

export function GoogleSignInButton() {
  return (
    <button
      className="flex h-12 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
      onClick={() => signIn("google", { callbackUrl: "/" })}
    >
      Sign in with Google
    </button>
  );
}
