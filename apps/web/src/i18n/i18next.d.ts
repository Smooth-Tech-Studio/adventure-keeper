import "i18next";

import type { resources } from "@/i18n";

// French is the source language: its files type every `t()` key.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: (typeof resources)["fr"];
    returnNull: false;
  }
}
