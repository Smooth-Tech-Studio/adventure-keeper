import { useRef } from "react";

/** Read a picked `.json` file as text, then reset the input so the same file can be picked again. */
export function useFilePicker(onText: (text: string, fileName: string) => void) {
  const input = useRef<HTMLInputElement>(null);
  const element = (
    <input
      ref={input}
      type="file"
      accept="application/json,.json"
      className="hidden"
      onChange={async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) onText(await file.text(), file.name);
      }}
    />
  );
  return { element, open: () => input.current?.click() };
}
