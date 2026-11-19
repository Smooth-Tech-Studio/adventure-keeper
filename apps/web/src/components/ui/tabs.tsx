import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva("text-muted-foreground inline-flex w-fit items-center", {
  variants: {
    variant: {
      /** A muted track, the active tab raised on it. */
      default: "bg-muted h-9 justify-center rounded-lg p-[3px]",
      /** Text tabs over a rule, the active one underlined. */
      line: "w-full justify-start gap-1 border-b",
      /** Rounded pills, the active one filled. */
      pill: "flex-wrap gap-1.5",
    },
  },
  defaultVariants: { variant: "default" },
});

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), "group/tabs-list", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "text-muted-foreground hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring inline-flex items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // default: a raised chip on the muted track.
        "group-data-[variant=default]/tabs-list:h-[calc(100%-1px)] group-data-[variant=default]/tabs-list:flex-1 group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:border group-data-[variant=default]/tabs-list:border-transparent group-data-[variant=default]/tabs-list:px-2 group-data-[variant=default]/tabs-list:py-1 group-data-[variant=default]/tabs-list:data-[state=active]:bg-background group-data-[variant=default]/tabs-list:data-[state=active]:text-foreground group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm dark:group-data-[variant=default]/tabs-list:data-[state=active]:border-input dark:group-data-[variant=default]/tabs-list:data-[state=active]:bg-input/30",
        // line: underlined, the rule drawn over the list's border.
        "group-data-[variant=line]/tabs-list:-mb-px group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:px-3 group-data-[variant=line]/tabs-list:pt-2 group-data-[variant=line]/tabs-list:pb-2.5 group-data-[variant=line]/tabs-list:data-[state=active]:border-current group-data-[variant=line]/tabs-list:data-[state=active]:text-foreground",
        // pill: a rounded chip, filled when active.
        "group-data-[variant=pill]/tabs-list:rounded-full group-data-[variant=pill]/tabs-list:border group-data-[variant=pill]/tabs-list:px-3 group-data-[variant=pill]/tabs-list:py-1 group-data-[variant=pill]/tabs-list:data-[state=active]:border-transparent group-data-[variant=pill]/tabs-list:data-[state=active]:bg-foreground group-data-[variant=pill]/tabs-list:data-[state=active]:text-background",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
