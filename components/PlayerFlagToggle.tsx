"use client";

export function PlayerFlagToggle({
  action,
  name,
  label,
  defaultChecked,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <form action={action}>
      <label className="flex items-center gap-1">
        {/* Keyed on the saved value so a server-side change (e.g. "Unselect all") re-mounts the
            box - defaultChecked alone is only read on the first render. */}
        <input
          key={String(defaultChecked)}
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
        {label}
      </label>
    </form>
  );
}
