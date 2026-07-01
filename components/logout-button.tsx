"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Logout
    </button>
  );
}
