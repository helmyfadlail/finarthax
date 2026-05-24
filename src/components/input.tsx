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
      {label && <label className="block text-sm font-medium text-primary-700 mb-0.5 md:mb-1.5">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute -translate-y-1/2 left-3 top-1/2 text-primary-400">{icon}</div>}
        {minusNumber && <div className="absolute -translate-y-1/2 left-9 top-1/2 text-primary-400">{minusNumber}</div>}
        <input
          type={type}
          ref={ref}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full px-4 py-2.5 text-sm md:text-base rounded-lg border-2 border-primary-100 bg-white text-primary-900 placeholder:text-primary-300",
            "focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none",
            "transition-all duration-200",
            "disabled:bg-neutral-100 disabled:cursor-not-allowed",
            error && "border-red-500 focus:border-red-500 focus:ring-red-200",
            icon && "pl-10",
            minusNumber && "pl-11",
            type === "number" && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            className,
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-0.5 md:mt-1.5 text-sm text-red-500">{error}</p>}
    </div>
  );
});

Input.displayName = "Input";

export { Input };
