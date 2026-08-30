// @ts-nocheck
"use client";

import { ChevronDown } from "lucide-react";
import { forwardRef, useId } from "react";

import { cn, andromedaVars } from "./lib/utils";
import { inputVariants } from "./Input";

export const Select = forwardRef<any, any>(function Select(
  {
    children,
    className,
    disabled,
    error,
    id: idProp,
    label,
    style,
    wrapperClassName,
    ...props
  },
  ref,
) {
  const reactId = useId();
  const id = idProp ?? `andromeda-select-${reactId}`;
  const errorId = error ? `${id}-error` : undefined;
  const state = error ? "error" : "default";

  return (
    <div
      className={cn("flex flex-col gap-[var(--andromeda-2)]", wrapperClassName)}
      style={{ ...andromedaVars(), ...style }}
    >
      {label ? (
        <label
          className={cn(
            "[font-family:var(--andromeda-font-mono)]",
            "text-[length:var(--andromeda-text-xs)]",
            "font-[number:var(--andromeda-weight-medium)]",
            "uppercase [letter-spacing:var(--andromeda-tracking-wider)]",
            "text-[color:var(--andromeda-text-secondary)]",
          )}
          htmlFor={id}
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        <select
          aria-describedby={errorId}
          aria-invalid={error ? "true" : undefined}
          className={cn(
            inputVariants({ hasIcon: false, state }),
            "appearance-none pr-[var(--andromeda-10)]",
            className,
          )}
          disabled={disabled}
          id={id}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-[var(--andromeda-3)] top-1/2 size-4 -translate-y-1/2 text-[color:var(--andromeda-text-muted)]"
        />
      </div>

      {error ? (
        <span
          className={cn(
            "[font-family:var(--andromeda-font-mono)]",
            "text-[length:var(--andromeda-text-xs)]",
            "text-[color:var(--andromeda-red-300)]",
            "uppercase [letter-spacing:var(--andromeda-tracking-wide)]",
          )}
          id={errorId}
          role="alert"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
});
