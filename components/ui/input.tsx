"use client";

interface InputProps {
  id?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string | undefined;
  disabled?: boolean;
}

export function Input({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  label,
  error,
  disabled,
}: Readonly<InputProps>): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-white/70">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          flex h-10 w-full rounded-lg px-3 py-2 text-sm
          bg-white/[0.04] border text-white
          placeholder:text-white/25
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-0
          disabled:cursor-not-allowed disabled:opacity-40
          transition-colors duration-150
          ${error
            ? "border-red-500/50 focus-visible:ring-red-500/50"
            : "border-white/10 hover:border-white/20 focus-visible:border-blue-500/50"
          }
        `}
      />
      {error && (
        <span className="text-xs text-red-400/90">
          {error}
        </span>
      )}
    </div>
  );
}
