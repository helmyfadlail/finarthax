import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "bg-primary-500 dark:bg-secondary-400 text-white dark:text-primary-900",
    success: "bg-emerald-500 dark:bg-emerald-600 text-white",
    warning: "bg-amber-500 dark:bg-amber-600 text-white",
    error: "bg-rose-500 dark:bg-rose-600 text-white",
    info: "bg-secondary-400 dark:bg-secondary-500 text-white dark:text-primary-900",
    outline: "border-2 border-primary-500 dark:border-secondary-400 text-primary-500 dark:text-secondary-400 bg-transparent",
  };

  return (
    <span
      ref={ref}
      className={cn("inline-flex items-center gap-1 rounded-full font-medium", "text-xs px-2 py-0.5", "md:text-sm md:px-2.5 md:py-1", "lg:text-sm lg:px-3 lg:py-1", variants[variant], className)}
      {...props}
    />
  );
});
Badge.displayName = "Badge";

export { Badge };
