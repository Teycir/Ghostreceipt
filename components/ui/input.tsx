"use client";

interface InputProps {
  id?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  description?: string;
  error?: string | undefined;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
}

export function Input({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  label,
  description,
  error,
  disabled,
  className = "",
  containerClassName = "",
  labelClassName = "",
  descriptionClassName = "",
}: Readonly<InputProps>): React.JSX.Element {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className={`text-sm font-medium text-white/70 ${labelClassName}`}>
          {label}
        </label>
      )}
      {description && (
        <p className={`text-[10px] leading-snug text-white/45 ${descriptionClassName}`}>
          {description}
        </p>
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
          ${className}
        `}
      />
      {error && (
        <span className="text-[11px] leading-snug break-words [overflow-wrap:anywhere] text-red-400/90 sm:text-xs">
          {error}
        </span>
      )}
    </div>
  );
}
