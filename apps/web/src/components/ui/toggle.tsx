import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 " +
    // Monochrome theme: the fill stays pale (so text / icons keep their dark
    // colour) and the selection is carried by an inset ring + bold weight.
    "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:font-semibold data-[state=on]:ring-1 data-[state=on]:ring-inset data-[state=on]:ring-foreground/30",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground data-[state=on]:border-foreground/30",
      },
      size: {
        default: "h-9 min-w-9 px-2.5",
        sm: "h-8 min-w-8 px-2",
        lg: "h-10 min-w-10 px-3",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
