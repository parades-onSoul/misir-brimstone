import * as React from "react";
import { cn } from "../../lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-zinc-800 text-zinc-100 border-zinc-700",
    success: "bg-green-900/30 text-green-400 border-green-800",
    warning: "bg-yellow-900/30 text-yellow-400 border-yellow-800",
    destructive: "bg-red-900/30 text-red-400 border-red-800",
    outline: "bg-transparent text-zinc-400 border-zinc-700",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
