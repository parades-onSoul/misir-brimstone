/**
 * Misir Icon Wrapper - Linear Edition
 * 
 * Enforces consistent icon styling across the application:
 * - 1.5px stroke weight (technical precision)
 * - Size hierarchy (12px → 16px → 18px → 24px)
 * - Opacity-based state system
 */

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconProps extends React.ComponentPropsWithoutRef<"svg"> {
  icon: LucideIcon;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "default" | "muted" | "active" | "primary";
}

const sizeMap = {
  xs: "size-3", // 12px - Metadata
  sm: "size-3.5", // 14px - Sub-items
  md: "size-4", // 16px - Standard (Buttons, Lists)
  lg: "size-[18px]", // 18px - Sidebar Navigation
  xl: "size-6", // 24px - Hero sections
};

const variantMap = {
  default: "text-[#8A8F98] group-hover:text-[#C4C9D6]",
  muted: "text-[#5F646D]",
  active: "text-[#EEEEF0]",
  primary: "text-[#5E6AD2]",
};

export const Icon = ({
  icon: IconComponent,
  size = "md",
  variant = "default",
  className,
  ...props
}: IconProps) => {
  return (
    <IconComponent
      strokeWidth={1.5} // The Linear Rule
      className={cn(
        sizeMap[size],
        variantMap[variant],
        "transition-colors duration-150",
        className
      )}
      {...props}
    />
  );
};
