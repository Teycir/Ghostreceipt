"use client";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string | undefined;
}

export function Select({
  label,
  error,
  className = "",
  children,
  ...props
}: SelectProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-white/70">
          {label}
        </label>
      )}
      <select
        className={`
          flex h-10 w-full rounded-lg border px-3 py-2 text-sm
          bg-white/[0.04] text-white
          [color-scheme:dark]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-0
          disabled:cursor-not-allowed disabled:opacity-40
          transition-colors duration-150
          ${error
            ? "border-red-500/50"
            : "border-white/10 hover:border-white/20 focus-visible:border-blue-500/50"
          }
          ${className}
        `}
        style={{ colorScheme: 'dark' }}
        {...props}
      >
        {children}
      </select>
      {error && (
        <span className="text-xs text-red-400/90">
          {error}
        </span>
      )}
    </div>
  );
}
