import { forwardRef, HTMLAttributes } from "react";

import { cn } from "@/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "bg-primary text-white",
    success: "bg-green-500 text-white",
    warning: "bg-yellow-500 text-white",
    error: "bg-red-500 text-white",
    info: "bg-blue-500 text-white",
    outline: "border-2 border-primary text-primary bg-transparent",
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
