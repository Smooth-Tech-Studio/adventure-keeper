import type { ComponentProps } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      // next-themes renders a <script> that sets the theme before paint on a
      // server-rendered page. Rendered by React on the client, it never runs,
      // and React says so. As a data block it stays inert and React keeps quiet.
      scriptProps={{ type: "application/json" }}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
