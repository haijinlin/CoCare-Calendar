import { CalendarDays } from "lucide-react";

type BrandMarkProps = {
  compact?: boolean;
  href?: string;
};

export function BrandMark({ compact = false, href = "/" }: BrandMarkProps) {
  const content = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white shadow-sm">
        <CalendarDays className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-semibold leading-tight text-slate-950">CoCare</div>
        {!compact ? (
          <div className="text-xs leading-tight text-slate-500">Derick's care calendar</div>
        ) : null}
      </div>
    </>
  );

  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      aria-label="Go to CoCare calendar"
    >
      {content}
    </a>
  );
}
