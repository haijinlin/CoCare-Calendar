"use client";

import type { ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  className?: string;
  confirmMessage: string;
  children: ReactNode;
};

export function ConfirmSubmitButton({
  className,
  confirmMessage,
  children,
}: ConfirmSubmitButtonProps) {
  return (
    <button
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
