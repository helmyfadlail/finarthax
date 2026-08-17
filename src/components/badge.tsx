import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "bg-primary-500 dark:bg-secondary-400 text-on-solid dark:text-on-bright",
    success: "bg-success-500 dark:bg-success-600 text-on-solid",
    warning: "bg-warning-500 dark:bg-warning-600 text-on-solid",
    error: "bg-danger-500 dark:bg-danger-600 text-on-solid",
    info: "bg-secondary-600 dark:bg-secondary-400 text-on-solid dark:text-on-bright",
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
