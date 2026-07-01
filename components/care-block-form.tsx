import { CareBlock, Child } from "@prisma/client";
import { endOfDay, format, startOfDay } from "date-fns";
import { Save, Trash2, X } from "lucide-react";
import { createCareBlock, deleteCareBlock, updateCareBlock } from "@/app/actions";
import { ParentLabels } from "@/lib/parents";

type CareBlockFormProps = {
  children: Child[];
  careBlock?: CareBlock | null;
  parentLabels: ParentLabels;
  defaultDate?: Date | null;
  returnTo: string;
};

function dateTimeLocal(value: Date) {
  return format(value, "yyyy-MM-dd'T'HH:mm");
}

export function CareBlockForm({
  children,
  careBlock,
  parentLabels,
  defaultDate,
  returnTo,
}: CareBlockFormProps) {
  const action = careBlock ? updateCareBlock.bind(null, careBlock.id) : createCareBlock;
  const defaultStartsAt = defaultDate ? startOfDay(defaultDate) : null;
  const defaultEndsAt = defaultDate ? endOfDay(defaultDate) : null;

  return (
    <section id="care-block-form" className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            {careBlock ? "Edit manual care" : "New manual care"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Advanced correction only. Use change requests for agreed schedule changes and handover
            notes for reminders.
          </p>
        </div>
        {careBlock ? (
          <a
            href={`${returnTo}#care-block-form`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Cancel edit"
          >
            <X className="h-4 w-4" />
          </a>
        ) : null}
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <label className="block">
          <span className="text-xs font-medium uppercase text-slate-500">Child</span>
          <select
            name="childId"
            defaultValue={careBlock?.childId ?? children[0]?.id}
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-500"
            required
          >
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase text-slate-500">Parent</span>
          <select
            name="parentRole"
            defaultValue={careBlock?.parentRole ?? "PARENT_A"}
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-500"
            required
          >
            <option value="PARENT_A">{parentLabels.PARENT_A}</option>
            <option value="PARENT_B">{parentLabels.PARENT_B}</option>
            <option value="BOTH">Both parents</option>
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Starts</span>
            <input
              name="startsAt"
              type="datetime-local"
              defaultValue={
                careBlock
                  ? dateTimeLocal(careBlock.startsAt)
                  : defaultStartsAt
                    ? dateTimeLocal(defaultStartsAt)
                    : ""
              }
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-slate-500"
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase text-slate-500">Ends</span>
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={
                careBlock
                  ? dateTimeLocal(careBlock.endsAt)
                  : defaultEndsAt
                    ? dateTimeLocal(defaultEndsAt)
                    : ""
              }
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-slate-500"
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium uppercase text-slate-500">Handover note</span>
          <textarea
            name="handoverNote"
            defaultValue={careBlock?.handoverNote ?? ""}
            rows={4}
            className="mt-1 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-500"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Save className="h-4 w-4" />
            {careBlock ? "Save changes" : "Create block"}
          </button>
        </div>
      </form>

      {careBlock ? (
        <form action={deleteCareBlock.bind(null, careBlock.id)} className="mt-3">
          <input type="hidden" name="returnTo" value={returnTo} />
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete block
          </button>
        </form>
      ) : null}
    </section>
  );
}
