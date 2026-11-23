"use client";

// A password field with an underlined "Show" link-button inside it (UX-DR53). The parent owns
// whether the password is shown, so Log in can hide it again after a wrong login (Story 9.2).

import { Button } from "@/components/common/button";
import { Input, type InputProps } from "@/components/common/input";
import { cn } from "@/lib/utils";

export const SHOW_PASSWORD = "Show";
export const HIDE_PASSWORD = "Hide";

export type PasswordInputProps = Omit<InputProps, "type"> & {
  shown: boolean;
  onShownChange: (shown: boolean) => void;
};

export function PasswordInput({ shown, onShownChange, id, className, ...rest }: PasswordInputProps) {
  return (
    <div className="relative">
      <Input id={id} type={shown ? "text" : "password"} className={cn("h-[40px]! pr-16", className)} {...rest} />
      <Button
        variant="link"
        className="absolute top-1/2 right-3 -translate-y-1/2"
        aria-controls={id}
        aria-label={shown ? "Hide password" : "Show password"}
        onClick={() => onShownChange(!shown)}
      >
        {shown ? HIDE_PASSWORD : SHOW_PASSWORD}
      </Button>
    </div>
  );
}
