import * as React from "react"

import { cn } from "../../lib/utils.js"
import { FIELD_HEIGHT, FIELD_PADDING } from "./formDensity.js"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        `flex ${FIELD_HEIGHT} w-full rounded-lg border border-border-control bg-muted ${FIELD_PADDING} text-sm text-text-primary transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-text-disabled`,
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
