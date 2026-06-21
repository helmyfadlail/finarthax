import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  responsiveFullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = "primary", size = "md", isLoading = false, disabled, responsiveFullWidth = false, children, ...props }, ref) => {
  const baseStyles =
    "cursor-pointer inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 whitespace-nowrap " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-primary-500 dark:bg-secondary-400 text-white dark:text-primary-900 hover:bg-primary-600 dark:hover:bg-secondary-500 focus:ring-primary-400 dark:focus:ring-secondary-400 shadow-sm hover:shadow-md active:scale-95",
    secondary: "bg-secondary-400 dark:bg-secondary-500 text-white hover:bg-secondary-500 dark:hover:bg-secondary-400 focus:ring-secondary-400 shadow-sm hover:shadow-md active:scale-95",
    outline:
      "border-2 border-primary-500 dark:border-secondary-400 text-primary-500 dark:text-secondary-400 hover:bg-primary-500 dark:hover:bg-secondary-400 hover:text-white dark:hover:text-primary-900 focus:ring-primary-400 active:scale-95",
    ghost: "text-primary-600 dark:text-primary-800 hover:bg-primary-100 dark:hover:bg-primary-300 focus:ring-primary-400 active:scale-95",
    danger: "bg-rose-500 text-white hover:bg-rose-600 focus:ring-rose-500 shadow-sm hover:shadow-md active:scale-95",
  };

  const sizes = {
    sm: "text-xs  px-2.5 py-1   gap-1    md:text-xs  md:px-3   md:py-1.5 md:gap-1   lg:text-sm  lg:px-3.5 lg:py-1.5 lg:gap-1.5",
    md: "text-sm  px-3   py-1.5 gap-1.5  md:text-sm  md:px-3.5 md:py-2   md:gap-1.5 lg:text-sm  lg:px-4   lg:py-2   lg:gap-2",
    lg: "text-sm  px-3.5 py-2   gap-1.5  md:text-base md:px-4  md:py-2.5 md:gap-2   lg:text-base lg:px-5  lg:py-2.5 lg:gap-2",
  };

  const spinnerSizes = { sm: "w-3 h-3", md: "w-3.5 h-3.5", lg: "w-4 h-4" };

  return (
    <button ref={ref} className={cn(baseStyles, variants[variant], sizes[size], responsiveFullWidth && "w-full md:w-auto", className)} disabled={disabled || isLoading} {...props}>
      {isLoading && (
        <svg className={cn("animate-spin shrink-0", spinnerSizes[size])} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
});
Button.displayName = "Button";

export { Button };
