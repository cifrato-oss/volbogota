"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("data-placeholder:text-muted-foreground truncate text-left", className)}
      {...props}
    />
  );
}

function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "border-input bg-input/30 hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 data-pressed:bg-input/50 flex h-9 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm transition-colors outline-none select-none focus-visible:ring-[3px] data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-muted-foreground flex shrink-0">
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        className="z-50 outline-none"
        sideOffset={6}
        alignItemWithTrigger={false}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "bg-popover text-popover-foreground border-border max-h-[var(--available-height)] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-y-auto rounded-lg border p-1 shadow-md transition-[transform,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground relative grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-md py-2 pr-2 pl-2 text-sm outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="col-start-1 flex items-center justify-center">
        <HugeiconsIcon icon={Tick02Icon} className="size-4" strokeWidth={2} />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="col-start-2">{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
