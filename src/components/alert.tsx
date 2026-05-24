import { forwardRef, HTMLAttributes } from "react";

import { cn } from "@/utils";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "error" | "info";
  icon?: React.ReactNode;
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(({ className, variant = "default", icon, children, ...props }, ref) => {
  const variants = {
    default: "bg-primary-50 border-primary-200 text-primary-900",
    success: "bg-green-50 border-green-200 text-green-900",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
    error: "bg-red-50 border-red-200 text-red-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
  };

  const iconColors = {
    default: "text-primary-600",
    success: "text-green-600",
    warning: "text-yellow-600",
    error: "text-red-600",
    info: "text-blue-600",
  };

  return (
    <div ref={ref} className={cn("relative w-full rounded-lg border flex items-start", "p-3 gap-2", "md:p-4 md:gap-3", "lg:p-5 lg:gap-4", variants[variant], className)} {...props}>
      {icon && <div className={cn("shrink-0", iconColors[variant])}>{icon}</div>}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
});
Alert.displayName = "Alert";

const AlertTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("font-semibold", "text-sm mb-0.5", "md:text-base md:mb-1", "lg:text-base lg:mb-1", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("opacity-90", "text-xs", "md:text-sm", "lg:text-sm", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
