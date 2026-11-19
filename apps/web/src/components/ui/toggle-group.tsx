import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
  size: "default",
  variant: "default",
});

function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "flex w-fit flex-wrap items-center gap-1",
        variant === "outline" && "gap-0 rounded-md shadow-xs [&>*]:rounded-none [&>*]:shadow-none",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext);
  const resolved = { variant: context.variant || variant, size: context.size || size };

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={resolved.variant}
      data-size={resolved.size}
      className={cn(
        toggleVariants(resolved),
        resolved.variant === "outline" &&
          "min-w-0 flex-1 border-l-0 first:border-l focus:z-10 focus-visible:z-10 data-[state=on]:z-10",
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
