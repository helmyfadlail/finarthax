"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import { cn } from "@/utils";

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  position?: string;
}

export const Dropdown = ({ trigger, children, align = "right", position = "origin-top" }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative inline-block w-full text-left">
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      <div
        className={cn(
          "absolute z-10 mt-1.5 rounded-xl overflow-hidden shadow-lg focus:outline-none transition-all duration-100",
          "w-44 md:w-52 lg:w-56",
          "bg-white dark:bg-primary-200",
          "border border-primary-100 dark:border-primary-400",
          align === "right" ? "right-0" : "left-0",
          position,
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none",
        )}
      >
        {children}
      </div>
    </div>
  );
};

interface DropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  danger?: boolean;
}

export const DropdownItem = ({ children, onClick, icon, danger }: DropdownItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      "group flex w-full items-center transition-colors",
      "gap-2 px-3 py-2 text-xs",
      "md:gap-2.5 md:px-3.5 md:py-2.5 md:text-xs",
      "lg:gap-3 lg:px-4 lg:py-3 lg:text-sm",
      danger ? "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20" : "text-primary-900 dark:text-primary-900 hover:bg-primary-50 dark:hover:bg-primary-300",
    )}
  >
    {icon && <span className="shrink-0">{icon}</span>}
    <span>{children}</span>
  </button>
);

export const DropdownDivider = () => <div className="h-px my-0.5 md:my-1 bg-primary-100 dark:bg-primary-400" />;
