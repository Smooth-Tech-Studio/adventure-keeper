import ReactMarkdown, { type Components } from "react-markdown";
import { Link } from "react-router-dom";

import { useCodexLinks } from "@/hooks/use-codex";
import { linkMentions } from "@/lib/codex-mentions";
import { cn } from "@/lib/utils";

// Tailwind has no prose styles here (no typography plugin): each element gets
// its own classes. Raw HTML is not rendered (react-markdown's default).
const components: Components = {
  h1: ({ node: _node, ...props }) => (
    <h3 className="mt-4 text-lg font-semibold first:mt-0" {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h4 className="mt-4 text-base font-semibold first:mt-0" {...props} />
  ),
  h3: ({ node: _node, ...props }) => <h5 className="mt-3 font-semibold first:mt-0" {...props} />,
  // Deeper levels share one small style rather than falling back to plain text.
  h4: ({ node: _node, ...props }) => (
    <h6 className="mt-3 text-sm font-semibold first:mt-0" {...props} />
  ),
  h5: ({ node: _node, ...props }) => (
    <h6 className="mt-3 text-sm font-semibold first:mt-0" {...props} />
  ),
  h6: ({ node: _node, ...props }) => (
    <h6 className="mt-3 text-sm font-semibold first:mt-0" {...props} />
  ),
  p: ({ node: _node, ...props }) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
  ul: ({ node: _node, ...props }) => <ul className="my-2 list-disc pl-5" {...props} />,
  ol: ({ node: _node, ...props }) => <ol className="my-2 list-decimal pl-5" {...props} />,
  li: ({ node: _node, ...props }) => <li className="my-0.5" {...props} />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote className="text-muted-foreground my-2 border-l-2 pl-3 italic" {...props} />
  ),
  a: ({ node: _node, href, children, ...props }) =>
    // In-app links (codex mentions) stay in the app; the rest opens a new tab.
    href?.startsWith("/") ? (
      <Link to={href} className="text-primary font-medium underline decoration-dotted">
        {children}
      </Link>
    ) : (
      <a
        className="text-primary underline"
        target="_blank"
        rel="noreferrer noopener"
        href={href}
        {...props}
      >
        {children}
      </a>
    ),
  hr: () => <hr className="my-3" />,
  code: ({ node: _node, ...props }) => (
    <code className="bg-muted rounded px-1 py-0.5 text-[0.9em]" {...props} />
  ),
  img: ({ node: _node, alt, ...props }) => (
    <img
      className="my-2 max-h-96 max-w-full rounded-md"
      loading="lazy"
      alt={alt ?? ""}
      {...props}
    />
  ),
};

/**
 * Tighter reading for a character's story (journal, chapters): shorter lines,
 * paragraphs closer together, a heading close to the text it introduces, and
 * headings a size down so the entry's own title stays above them.
 */
const COMPACT = cn(
  "leading-snug",
  "[&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_blockquote]:my-1.5",
  "[&_h3]:mt-3 [&_h3]:text-base [&_h4]:mt-3 [&_h4]:text-sm [&_h5]:mt-2.5 [&_h6]:mt-2.5",
  "[&_:is(h3,h4,h5,h6)+:is(p,ul,ol,blockquote)]:mt-0.5",
);

/** Renders GM- or player-written Markdown (recaps, journals) as styled text. */
export function Markdown({
  children,
  className,
  compact = false,
}: {
  children: string;
  className?: string;
  /** The story's tighter spacing (see {@link COMPACT}). */
  compact?: boolean;
}) {
  // `[[Nom]]` mentions: a link to the codex entry when the reader knows it.
  const resolve = useCodexLinks();
  const text = resolve ? linkMentions(children, resolve) : linkMentions(children, () => null);
  return (
    <div className={cn("text-sm leading-relaxed break-words", compact && COMPACT, className)}>
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  );
}
