import { forwardRef, InputHTMLAttributes } from "react";

import { cn } from "@/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  minusNumber?: React.ReactNode;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, label, error, icon, minusNumber, type = "text", onWheel, onKeyDown, ...props }, ref) => {
  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    if (type === "number") {
      e.currentTarget.blur();
      if (onWheel) onWheel(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (type === "number") {
      const allowedKeys = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];

      const isNumber = /^[0-9]$/.test(e.key);
      const isDecimal = e.key === "." && !e.currentTarget.value.includes(".");
      const isCtrlCmd = e.ctrlKey || e.metaKey;

      if (!isNumber && !isDecimal && !allowedKeys.includes(e.key) && !isCtrlCmd) {
        e.preventDefault();
      }
    }

    if (onKeyDown) onKeyDown(e);
  };

  return (
    <div className="w-full">
      {label && <label className="block text-xs font-medium text-primary-700 dark:text-primary-800 mb-1 md:text-sm md:mb-1.5">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400 dark:text-primary-600 pointer-events-none">{icon}</div>}
        {minusNumber && <div className="absolute -translate-y-1/2 left-9 top-1/2 text-primary-400">{minusNumber}</div>}
        <input
          type={type}
          ref={ref}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full rounded-lg border-2 transition-all duration-200",
            "bg-white dark:bg-primary-300",
            "border-primary-100 dark:border-primary-400",
            "text-primary-900 dark:text-primary-900",
            "placeholder:text-primary-300 dark:placeholder:text-primary-600",
            "focus:border-primary-500 dark:focus:border-secondary-400",
            "focus:ring-2 focus:ring-primary-200 dark:focus:ring-secondary-400/30 focus:outline-none",
            "disabled:bg-primary-50 dark:disabled:bg-primary-200 disabled:cursor-not-allowed",
            "px-4 py-2.5 text-sm md:text-base lg:text-base",
            error && "border-rose-500 focus:border-rose-500 focus:ring-rose-200",
            icon && "pl-10",
            minusNumber && "pl-11",
            type === "number" && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            className,
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-rose-500 md:mt-1.5 md:text-sm">{error}</p>}
    </div>
  );
});

Input.displayName = "Input";

export { Input };
