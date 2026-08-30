import * as React from "react";

import { cn } from "@/lib/utils";

function ButtonGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-fit items-center [&>[data-slot=button]:not(:first-child)]:-ml-px [&>[data-slot=button]:not(:first-child)]:rounded-l-none [&>[data-slot=button]:not(:last-child)]:rounded-r-none [&>[data-slot=button]:focus-visible]:relative [&>[data-slot=button]:focus-visible]:z-10",
        className,
      )}
      data-slot="button-group"
      role="group"
      {...props}
    />
  );
}

export { ButtonGroup };
