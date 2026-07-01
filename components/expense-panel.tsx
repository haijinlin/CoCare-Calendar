import { Expense, User } from "@prisma/client";
import { format } from "date-fns";
import { CheckCircle, DollarSign, Trash2 } from "lucide-react";
import { createExpense, deleteExpense, settleExpense } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type ExpenseWithUser = Expense & { paidBy: User };

type ExpensePanelProps = {
  expenses: ExpenseWithUser[];
  users: User[];
  currentUser: User;
  defaultDate?: Date | null;
  expenseStatus: "open" | "settled" | "all";
  returnTo: string;
};

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ExpensePanel({
  expenses,
  users,
  currentUser,
  defaultDate,
  expenseStatus,
  returnTo,
}: ExpensePanelProps) {
  const openExpenses = expenses.filter((expense) => expense.status === "OPEN");
  const visibleExpenses = expenses.filter((expense) => {
    if (expenseStatus === "open") return expense.status === "OPEN";
    if (expenseStatus === "settled") return expense.status === "SETTLED";
    return true;
  });
  const totalOpen = openExpenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const defaultIncurredOn = defaultDate ?? new Date();
  const [firstUser, secondUser] = users;
  const firstPaid = firstUser
    ? openExpenses
        .filter((expense) => expense.paidById === firstUser.id)
        .reduce((sum, expense) => sum + expense.amountCents, 0)
    : 0;
  const secondPaid = secondUser
    ? openExpenses
        .filter((expense) => expense.paidById === secondUser.id)
        .reduce((sum, expense) => sum + expense.amountCents, 0)
    : 0;
  const reimbursement =
    firstUser && secondUser && totalOpen > 0
      ? (() => {
          const firstBalance = firstPaid - totalOpen / 2;

          if (Math.abs(firstBalance) < 0.5) return null;

          return firstBalance > 0
            ? {
                owedBy: secondUser.name,
                owedTo: firstUser.name,
                amount: firstBalance,
              }
            : {
                owedBy: firstUser.name,
                owedTo: secondUser.name,
                amount: Math.abs(firstBalance),
              };
        })()
      : null;

  return (
    <section id="expenses" className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-950">Expenses</h2>
        <div className="text-sm font-medium text-slate-600">{dollars(totalOpen)} open</div>
      </div>

      {firstUser && secondUser ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">{firstUser.name} paid</span>
            <span className="font-medium text-slate-950">{dollars(firstPaid)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-slate-500">{secondUser.name} paid</span>
            <span className="font-medium text-slate-950">{dollars(secondPaid)}</span>
          </div>
          <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
            {reimbursement ? (
              <>
                50/50 estimate: {reimbursement.owedBy} owes {reimbursement.owedTo}{" "}
                <span className="font-semibold text-slate-950">
                  {dollars(Math.round(reimbursement.amount))}
                </span>
              </>
            ) : totalOpen > 0 ? (
              "50/50 estimate: balanced"
            ) : (
              "No open expenses to split."
            )}
          </div>
        </div>
      ) : null}

      <form action={createExpense} className="mt-4 space-y-3">
        <input type="hidden" name="returnTo" value={returnTo} />
        <input
          name="title"
          placeholder="Expense title"
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
            required
          />
          <input
            name="incurredOn"
            type="date"
            defaultValue={format(defaultIncurredOn, "yyyy-MM-dd")}
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
            required
          />
        </div>
        <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
          Paid by {currentUser.name}
        </div>
        <textarea
          name="notes"
          rows={2}
          placeholder="Notes"
          className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <button
          type="submit"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
        >
          <DollarSign className="h-4 w-4" />
          Add expense
        </button>
      </form>

      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase text-slate-500">Expense list</h3>
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
            {[
              { value: "open", label: "Open" },
              { value: "settled", label: "Settled" },
              { value: "all", label: "All" },
            ].map((status) => (
              <a
                key={status.value}
                href={`${returnTo}${returnTo.includes("?") ? "&" : "?"}expenseStatus=${status.value}#expenses`}
                className={`inline-flex h-7 items-center rounded px-2 text-xs font-medium ${
                  expenseStatus === status.value
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {status.label}
              </a>
            ))}
          </div>
        </div>

        {visibleExpenses.map((expense) => (
          <div key={expense.id} className="rounded-md border border-slate-200 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-slate-950">{expense.title}</div>
                <div className="text-slate-500">
                  {expense.paidBy.name} - {format(expense.incurredOn, "d MMM yyyy")}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-950">
                  {dollars(expense.amountCents)}
                </div>
                <div className="text-xs text-slate-500">{expense.status.toLowerCase()}</div>
              </div>
            </div>
            {expense.notes ? <div className="mt-2 text-slate-700">{expense.notes}</div> : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {expense.status === "OPEN" ? (
                <form action={settleExpense.bind(null, expense.id)}>
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <ConfirmSubmitButton
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-teal-200 px-3 text-sm font-medium text-teal-700 hover:bg-teal-50"
                    confirmMessage="Mark this expense as settled?"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Settle
                  </ConfirmSubmitButton>
                </form>
              ) : (
                <div />
              )}
              <form action={deleteExpense.bind(null, expense.id)}>
                <input type="hidden" name="returnTo" value={returnTo} />
                <ConfirmSubmitButton
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                  confirmMessage="Delete this expense? This cannot be undone."
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>
        ))}
        {visibleExpenses.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
            No {expenseStatus === "all" ? "" : `${expenseStatus} `}expenses
          </div>
        ) : null}
      </div>
    </section>
  );
}
