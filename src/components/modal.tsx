"use client";

import { ReactNode, useEffect } from "react";

import { cn } from "@/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
}

export const Modal = ({ isOpen, onClose, title, description, children, size = "md", showCloseButton = true }: ModalProps) => {
  const sizes = {
    sm: "md:max-w-sm",
    md: "md:max-w-md",
    lg: "md:max-w-lg",
    xl: "md:max-w-xl",
    full: "md:max-w-full md:mx-4",
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="relative z-50">
      <div className={cn("fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300", isOpen ? "opacity-100" : "opacity-0")} />

      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex items-end justify-center min-h-full md:items-center md:p-4" onClick={handleBackdropClick}>
          <div
            className={cn(
              "w-full transform overflow-hidden bg-white shadow-2xl transition-all duration-300",
              "rounded-t-2xl p-4",
              "md:rounded-2xl md:p-6",
              sizes[size],
              isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4 md:translate-y-0",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 mx-auto mb-3 rounded-full bg-primary-200 md:hidden" />

            {(title || showCloseButton) && (
              <div className="flex items-start justify-between mb-3 md:mb-4">
                <div className="flex-1">
                  {title && <h2 className="text-base font-bold text-primary-900 md:text-xl">{title}</h2>}
                  {description && <p className="mt-0.5 text-xs text-primary-600 md:mt-1 md:text-sm">{description}</p>}
                </div>
                {showCloseButton && (
                  <button onClick={onClose} className="ml-3 transition-colors text-primary-400 hover:text-primary-600 md:ml-4">
                    <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            <div className="mt-3 md:mt-4">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
