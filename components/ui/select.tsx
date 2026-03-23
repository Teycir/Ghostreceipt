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
      <div className="relative">
        <select
          className={`
            flex h-11 w-full appearance-none rounded-xl border px-3 py-2 pr-10 text-sm
            bg-[linear-gradient(120deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]
            text-white
            [color-scheme:dark]
            shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_28px_rgba(12,24,66,0.35)]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 focus-visible:ring-offset-0
            disabled:cursor-not-allowed disabled:opacity-40
            transition-all duration-200
            ${error
              ? "border-red-500/50"
              : "border-white/20 hover:border-blue-200/30 focus-visible:border-blue-300/50"
            }
            ${className}
          `}
          style={{ colorScheme: 'dark' }}
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/70">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M6 9L12 15L18 9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      {error && (
        <span className="text-xs text-red-400/90">
          {error}
        </span>
      )}
    </div>
  );
}
