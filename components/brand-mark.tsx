import { CalendarDays } from "lucide-react";

type BrandMarkProps = {
  compact?: boolean;
  href?: string;
};

export function BrandMark({ compact = false, href = "/" }: BrandMarkProps) {
  const content = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 shadow-sm sm:h-10 sm:w-10">
        <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-base font-semibold leading-tight text-slate-950 sm:text-lg">
          CoCare
        </div>
        {!compact ? (
          <div className="text-[11px] leading-tight text-slate-500 sm:text-xs">
            Derick's care calendar
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <a
      href={href}
      className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:gap-3"
      aria-label="Go to CoCare calendar"
    >
      {content}
    </a>
  );
}
