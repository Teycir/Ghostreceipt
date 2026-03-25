"use client";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps): React.JSX.Element {
  const variantStyles: Record<string, string> = {
    primary:
      "border border-blue-200/30 text-white bg-gradient-to-r from-[#2f66ff] via-[#4f7bff] to-[#6a71ff] shadow-[0_12px_30px_rgba(45,92,255,0.45)] hover:brightness-110 hover:shadow-[0_16px_34px_rgba(63,113,255,0.55)] hover:-translate-y-[1px] active:scale-[0.98] active:shadow-[0_6px_16px_rgba(45,92,255,0.35)] active:translate-y-0",
    secondary:
      "bg-white/[0.06] border border-white/15 text-white/85 hover:bg-white/[0.11] hover:text-white hover:border-white/30 hover:-translate-y-[1px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] active:scale-[0.98] active:translate-y-0 active:bg-white/[0.08]",
    danger:
      "bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-400 hover:-translate-y-[1px] active:scale-[0.98] active:translate-y-0",
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium tracking-[0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-40 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
