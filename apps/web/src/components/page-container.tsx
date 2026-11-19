import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const SIZES = {
  /** Lists, detail pages, the guided creation: the whole window, like the navbar. */
  wide: "max-w-none",
  /** Long forms: a line of input wider than this reads badly. */
  form: "max-w-3xl",
  /** Short forms, single cards, messages. */
  narrow: "max-w-2xl",
} as const;

/** The page column every route renders into, so widths stay consistent. */
export function PageContainer({
  size = "wide",
  className,
  ...props
}: ComponentProps<"div"> & { size?: keyof typeof SIZES }) {
  return <div className={cn("mx-auto w-full px-4 py-8", SIZES[size], className)} {...props} />;
}
