"use client";

import { AlertTriangle, CalendarDays, RefreshCw } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <BrandMark />
        <section className="rounded-md border border-red-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-50 p-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold">CoCare had trouble loading this page</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This is usually a temporary server or database issue. Try again first; if it keeps
                happening, send Hayden the time and the code below.
              </p>
              {error.digest ? (
                <div className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-500">
                  Error code: {error.digest}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
            <a
              href="/"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <CalendarDays className="h-4 w-4" />
              Back to calendar
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
