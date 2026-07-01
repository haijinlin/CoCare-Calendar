import {
  ArrowLeft,
  Bell,
  CalendarCog,
  CalendarPlus,
  Download,
  Mail,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { requireCurrentFamilyMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

const settingsGroups = [
  {
    title: "Daily use",
    links: [
      {
        href: "/settings/calendar-export",
        title: "Calendar export",
        description:
          "Download Derick's care schedule as an ICS file for Google Calendar or Apple Calendar.",
        icon: CalendarPlus,
      },
      {
        href: "/settings/notifications",
        title: "Email notifications",
        description: "Check Resend configuration and send test emails to both parents.",
        icon: Mail,
      },
    ],
  },
  {
    title: "Maintenance",
    links: [
      {
        href: "/settings/rules",
        title: "Rules & holidays",
        description: "Maintain VIC school holidays, public holidays, and apply rules to the calendar.",
        icon: CalendarCog,
      },
      {
        href: "/activity",
        title: "Activity & export",
        description: "Review audit history and download change request, expense, and audit CSV files.",
        icon: Download,
      },
    ],
  },
];

export default async function SettingsPage() {
  const currentMember = await requireCurrentFamilyMember();

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between sm:pb-5">
          <div>
            <a
              href="/"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to calendar
            </a>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              Settings
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Manage rules, notifications, exports, and family calendar maintenance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="min-w-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 sm:px-3 sm:py-2 sm:text-sm"
              title={`Google account: ${currentMember.googleEmail}`}
            >
              <div className="truncate">
                Signed in as{" "}
                <span className="font-medium text-slate-950">{currentMember.user.name}</span>
              </div>
              <div className="hidden text-xs text-slate-400 sm:block">
                {currentMember.googleEmail}
              </div>
            </div>
            <LogoutButton />
          </div>
        </header>

        <section className="grid gap-5">
          {settingsGroups.map((group) => (
            <div key={group.title}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group.title}
              </h2>
              <div className="grid gap-3">
                {group.links.map((item) => {
                  const Icon = item.icon;

                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-950">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-500">{item.description}</div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <div className="flex gap-2">
            <Bell className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Rules changes are logged in Activity. They do not require approval, so routine holiday
              maintenance stays simple.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
