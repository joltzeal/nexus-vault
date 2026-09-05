import {
  ProgressBar as AriaProgressBar,
  type ProgressBarProps as AriaProgressBarProps,
  composeRenderProps,
} from "react-aria-components";

import { cn } from "@/lib/utils";
import { FieldLabel } from "./field";

export interface ProgressBarProps extends AriaProgressBarProps {
  label?: string;
}

export function ProgressBar({ label, ...props }: ProgressBarProps) {
  return (
    <AriaProgressBar
      {...props}
      className={composeRenderProps(props.className, (className) =>
        cn("flex flex-col gap-1", className),
      )}
    >
      {({ percentage, valueText, isIndeterminate }) => (
        <>
          <div className="flex justify-between gap-2">
            <FieldLabel>{label}</FieldLabel>
            <span className="text-muted-foreground text-sm">{valueText}</span>
          </div>
          <div className="bg-muted relative h-2 w-full overflow-hidden rounded-full outline outline-1 -outline-offset-1 outline-transparent">
            <div
              className={`bg-primary absolute top-0 h-full rounded-full forced-colors:bg-[Highlight] ${isIndeterminate ? "left-0 w-[34%] animate-progress-bar-indeterminate" : "left-0"}`}
              style={{ width: isIndeterminate ? "34%" : percentage + "%" }}
            />
          </div>
        </>
      )}
    </AriaProgressBar>
  );
}
