import { CareCredit } from "@prisma/client";
import { Check, Clock, RotateCcw, X } from "lucide-react";
import { approveCareCredit, cancelCareCredit, createCareCredit, settleCareCredit } from "@/app/actions";
import { ParentLabels } from "@/lib/parents";

type CareCreditPanelProps = {
  credits: CareCredit[];
  parentLabels: ParentLabels;
  currentUserId: string;
  currentUserRole: CareCredit["owedByRole"];
  returnTo: string;
};

function formatMinutes(minutes: number) {
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);
  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);

  return parts.length > 0 ? parts.join(" ") : "0h";
}

export function CareCreditPanel({
  credits,
  parentLabels,
  currentUserId,
  currentUserRole,
  returnTo,
}: CareCreditPanelProps) {
  const openCredits = credits.filter((credit) => credit.status === "OPEN");
  const pendingManualCredits = credits.filter(
    (credit) => credit.status === "PENDING" && !credit.sourceRequestId,
  );
  const haydenOwes = openCredits
    .filter((credit) => credit.owedByRole === "PARENT_A")
    .reduce((sum, credit) => sum + credit.remainingMinutes, 0);
  const constanceOwes = openCredits
    .filter((credit) => credit.owedByRole === "PARENT_B")
    .reduce((sum, credit) => sum + credit.remainingMinutes, 0);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-950">Make-up balance</h2>
        <Clock className="h-4 w-4 text-slate-400" />
      </div>

      <div className="mt-3 grid gap-2 text-sm">
        <div className="rounded-md bg-blue-50 px-3 py-2 text-blue-950">
          {parentLabels.PARENT_A} owes {parentLabels.PARENT_B}:{" "}
          <span className="font-semibold">{formatMinutes(haydenOwes)}</span>
        </div>
        <div className="rounded-md bg-rose-50 px-3 py-2 text-rose-950">
          {parentLabels.PARENT_B} owes {parentLabels.PARENT_A}:{" "}
          <span className="font-semibold">{formatMinutes(constanceOwes)}</span>
        </div>
      </div>

      {pendingManualCredits.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {pendingManualCredits.length} manual make-up request
          {pendingManualCredits.length === 1 ? "" : "s"} waiting for approval.
        </div>
      ) : null}

      <form action={createCareCredit} className="mt-4 space-y-3">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Owed by</span>
            <select
              name="owedByRole"
              defaultValue="PARENT_B"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
            >
              <option value="PARENT_A">{parentLabels.PARENT_A}</option>
              <option value="PARENT_B">{parentLabels.PARENT_B}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Owed to</span>
            <select
              name="owedToRole"
              defaultValue="PARENT_A"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500"
            >
              <option value="PARENT_A">{parentLabels.PARENT_A}</option>
              <option value="PARENT_B">{parentLabels.PARENT_B}</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            name="days"
            type="number"
            min="0"
            step="0.5"
            placeholder="Days"
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
          />
          <input
            name="hours"
            type="number"
            min="0"
            step="0.5"
            placeholder="Hours"
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
          />
        </div>
        <textarea
          name="reason"
          rows={2}
          placeholder="Reason"
          className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <button className="h-10 w-full rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800">
          Request balance
        </button>
        <p className="text-xs text-slate-500">Manual balances need the other parent's approval before they count.</p>
      </form>

      <div className="mt-4 space-y-3">
        {[...pendingManualCredits, ...openCredits].slice(0, 6).map((credit) => {
          const isPending = credit.status === "PENDING";
          const canApprove = isPending && credit.requestedById !== currentUserId;
          const canWithdraw = isPending && credit.requestedById === currentUserId;
          const canManageOpen = credit.status === "OPEN" && credit.owedToRole === currentUserRole;

          return (
          <div key={credit.id} className="rounded-md border border-slate-200 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium text-slate-950">
                {parentLabels[credit.owedByRole]} owes {parentLabels[credit.owedToRole]}{" "}
                {formatMinutes(credit.remainingMinutes)}
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                {credit.status.toLowerCase()}
              </span>
            </div>
            {credit.reason ? <div className="mt-1 text-slate-600">{credit.reason}</div> : null}
            {canApprove || canWithdraw || canManageOpen ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {canApprove ? (
                  <form action={approveCareCredit.bind(null, credit.id)}>
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-teal-200 px-3 text-sm font-medium text-teal-700 hover:bg-teal-50">
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                  </form>
                ) : null}
                {canWithdraw ? (
                  <form action={cancelCareCredit.bind(null, credit.id)}>
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <RotateCcw className="h-4 w-4" />
                      Withdraw
                    </button>
                  </form>
                ) : null}
                {canManageOpen ? (
                  <>
                    <form action={settleCareCredit.bind(null, credit.id)}>
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-teal-200 px-3 text-sm font-medium text-teal-700 hover:bg-teal-50">
                        <RotateCcw className="h-4 w-4" />
                        Settled
                      </button>
                    </form>
                    <form action={cancelCareCredit.bind(null, credit.id)}>
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50">
                        <X className="h-4 w-4" />
                        Cancel
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {isPending
                  ? "Waiting for the other parent to approve."
                  : `Only ${parentLabels[credit.owedToRole]} can settle or cancel this balance.`}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </section>
  );
}
