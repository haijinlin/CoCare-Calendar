import { Baby, UserRound } from "lucide-react";
import clsx from "clsx";

type PersonBadgeProps = {
  name: string;
  kind: "dad" | "mum" | "child";
  compact?: boolean;
};

const styles = {
  dad: "bg-blue-50 text-blue-700 ring-blue-100",
  mum: "bg-rose-50 text-rose-700 ring-rose-100",
  child: "bg-amber-50 text-amber-700 ring-amber-100",
};

export function PersonBadge({ name, kind, compact = false }: PersonBadgeProps) {
  const Icon = kind === "child" ? Baby : UserRound;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full ring-1",
        compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
        styles[kind],
      )}
    >
      <span
        className={clsx(
          "inline-flex items-center justify-center rounded-full bg-white/80",
          compact ? "h-5 w-5" : "h-6 w-6",
        )}
      >
        <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </span>
      <span className="font-medium">{name}</span>
    </span>
  );
}
