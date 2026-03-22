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
      "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/30 hover:shadow-blue-800/40",
    secondary:
      "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white hover:border-white/20",
    danger:
      "bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-400",
  };

  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:opacity-40 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
