import * as React from "react"

import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default"
}

function NativeSelect({
  className,
  size = "default",
  ...props
}: NativeSelectProps) {
  const invalid = props["aria-invalid"] ?? false

  return (
    <div
      className={cn(
        "group/native-select relative inline-flex w-fit items-center rounded-lg border border-input bg-background shadow-sm transition-colors has-[select:disabled]:opacity-50 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-[invalid=true]:border-destructive data-[invalid=true]:ring-3 data-[invalid=true]:ring-destructive/20 dark:bg-ink-900/80 dark:data-[invalid=true]:border-destructive/50 dark:data-[invalid=true]:ring-destructive/40",
        className
      )}
      data-slot="native-select-wrapper"
      data-size={size}
      data-invalid={invalid}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className="h-8 w-full min-w-0 appearance-none rounded-[inherit] border-0 bg-transparent py-1 pl-2.5 pr-8 text-sm text-foreground outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[size=sm]:h-7 data-[size=sm]:py-0.5"
        {...props}
      />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none" aria-hidden="true" data-slot="native-select-icon" />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
