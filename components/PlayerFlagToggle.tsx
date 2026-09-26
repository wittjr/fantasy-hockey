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
        <input
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
