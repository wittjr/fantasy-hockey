"use client";

import { useState } from "react";

export function RenamePlayerForm({
  action,
  currentName,
}: {
  action: (formData: FormData) => void | Promise<void>;
  currentName: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="italic text-amber-600 hover:underline dark:text-amber-500">
        {currentName} (click to rename)
      </button>
    );
  }

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input
        type="text"
        name="name"
        defaultValue=""
        placeholder="Real player name"
        autoFocus
        className="rounded border border-neutral-300 px-2 py-0.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button type="submit" className="text-sm underline">
        Save
      </button>
    </form>
  );
}
