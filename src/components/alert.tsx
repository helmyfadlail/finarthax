import { forwardRef, HTMLAttributes } from "react";
import { cn } from "@/utils";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "error" | "info";
  icon?: React.ReactNode;
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(({ className, variant = "default", icon, children, ...props }, ref) => {
  const variants = {
    default: "bg-primary-50 dark:bg-primary-300 border-primary-200 dark:border-primary-400 text-primary-900 dark:text-primary-900",
    success: "bg-success-100 dark:bg-success-800 border-success-300 dark:border-success-600 text-success-800 dark:text-success-300",
    warning: "bg-warning-100 dark:bg-warning-800 border-warning-300 dark:border-warning-600 text-warning-800 dark:text-warning-300",
    error: "bg-danger-100 dark:bg-danger-800 border-danger-300 dark:border-danger-600 text-danger-800 dark:text-danger-300",
    info: "bg-secondary-50 dark:bg-secondary-100 border-secondary-100 dark:border-secondary-300 text-secondary-700 dark:text-secondary-400",
  };

  const iconColors = {
    default: "text-primary-500 dark:text-primary-700",
    success: "text-success-600 dark:text-success-400",
    warning: "text-warning-600 dark:text-warning-400",
    error: "text-danger-600 dark:text-danger-400",
    info: "text-secondary-600 dark:text-secondary-400",
  };

  return (
    <div ref={ref} className={cn("relative w-full rounded-lg border flex items-start p-3 gap-2 md:p-4 md:gap-3 lg:p-5 lg:gap-4", variants[variant], className)} {...props}>
      {icon && <div className={cn("shrink-0", iconColors[variant])}>{icon}</div>}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
});
Alert.displayName = "Alert";

const AlertTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("font-semibold text-sm mb-0.5 md:text-base md:mb-1", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("opacity-90 text-xs md:text-sm", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
