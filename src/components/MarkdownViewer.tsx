import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { AnnotationForm } from "./AnnotationForm";
import { useEffect } from "react";

interface MarkdownViewerProps {
  content: string;
  url?: string;
}

// Extract text content from React children
const extractText = (children: any): string => {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) {
    return children.map(extractText).join("");
  }
  if (children?.props?.children) {
    return extractText(children.props.children);
  }
  return "";
};

// Generate a URL-friendly ID from heading text
const generateId = (children: any): string => {
  const text = extractText(children);
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .trim();
};

// Extract anchor IDs from HTML anchor tags before headings
// Pattern: <a id="m-2"></a> followed by a heading
const extractAnchorIds = (content: string): Map<string, string> => {
  const anchorMap = new Map<string, string>();

  // Parse line by line to find anchor tags followed by headings
  const lines = content.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    // Look for anchor tag on current line or combined with next line
    const currentLine = lines[i].trim();
    const anchorMatch = currentLine.match(/<a\s+id=["']([^"']+)["']\s*><\/a>/);

    if (anchorMatch) {
      const anchorId = anchorMatch[1];
      // Check if next line is a heading
      const nextLine = lines[i + 1]?.trim();
      if (nextLine && nextLine.match(/^#{1,6}\s+/)) {
        // Extract heading text (remove # and whitespace)
        const headingText = nextLine.replace(/^#{1,6}\s+/, "").trim();
        // Normalize heading text to create lookup key (same as generateId logic)
        const headingKey = headingText
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .trim();
        // Map the normalized heading text to the anchor ID
        if (headingKey) {
          anchorMap.set(headingKey, anchorId);
        }
      }
    } else {
      // Also check if anchor and heading are on the same line
      const combinedMatch = currentLine.match(
        /<a\s+id=["']([^"']+)["']\s*><\/a>\s*(#{1,6})\s+(.+)/
      );
      if (combinedMatch) {
        const [, anchorId, , headingText] = combinedMatch;
        const headingKey = headingText
          .trim()
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .trim();
        if (headingKey) {
          anchorMap.set(headingKey, anchorId);
        }
      }
    }
  }

  return anchorMap;
};

export const MarkdownViewer = ({ content, url }: MarkdownViewerProps) => {
  // Extract anchor IDs from the content
  const anchorIds = extractAnchorIds(content);

  // Create a helper to get ID for a heading
  const getHeadingId = (children: any, defaultId?: string): string => {
    // First check if there's an explicit anchor ID mapped
    const textKey = generateId(children);
    if (anchorIds.has(textKey)) {
      return anchorIds.get(textKey)!;
    }
    // Otherwise use the default generated ID or provided default
    return defaultId || textKey;
  };

  // Handle hash navigation on mount and when hash changes
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;

      // Wait for DOM to be ready (ReactMarkdown might still be rendering)
      const attemptScroll = (attempts = 0) => {
        const element = document.getElementById(hash);
        if (element) {
          // Use scrollIntoView for better browser optimization
          // The scroll-mt-20 class handles the offset automatically
          element.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        } else if (attempts < 20) {
          // Retry if element not found yet (ReactMarkdown might still be rendering)
          // Retry more times with shorter intervals for faster response
          setTimeout(() => attemptScroll(attempts + 1), 50);
        }
      };

      attemptScroll();
    };

    const handleHashChange = () => {
      scrollToHash();
    };

    // Handle initial hash after content has rendered
    // Shorter delay for faster response
    const timeoutId = setTimeout(() => {
      scrollToHash();
    }, 200);

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [content]);

  // Pre-process content to remove anchor tags (they'll be handled by heading IDs)
  const processedContent = content.replace(
    /<a\s+id=["'][^"']+["']\s*><\/a>\s*\n?/g,
    ""
  );

  // Split processed content by <!-- MD ... --> comments and create segments
  const mdCommentRegex = /<!--\s*MD[\s\S]*?-->/gi;
  const segments: Array<{ type: "markdown" | "annotation"; content: string }> =
    [];

  let lastIndex = 0;
  let match;

  while ((match = mdCommentRegex.exec(processedContent)) !== null) {
    // Add markdown before the comment
    if (match.index > lastIndex) {
      segments.push({
        type: "markdown",
        content: processedContent.substring(lastIndex, match.index),
      });
    }

    // Add annotation form placeholder
    segments.push({
      type: "annotation",
      content: "",
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining markdown
  if (lastIndex < processedContent.length) {
    segments.push({
      type: "markdown",
      content: processedContent.substring(lastIndex),
    });
  }

  // If no comments found, just render the full content
  if (segments.length === 0) {
    segments.push({
      type: "markdown",
      content: processedContent,
    });
  }

  const markdownComponents = {
    h1: ({ children, ...props }: any) => {
      const id = getHeadingId(children);
      return (
        <h1
          id={id}
          className="text-4xl font-bold text-markdown-heading mb-6 mt-8 first:mt-0 scroll-mt-20"
          {...props}
        >
          {children}
        </h1>
      );
    },
    h2: ({ children, ...props }: any) => {
      const id = getHeadingId(children);
      return (
        <h2
          id={id}
          className="text-3xl font-bold text-markdown-heading mb-5 mt-7 border-b border-border pb-2 scroll-mt-20"
          {...props}
        >
          {children}
        </h2>
      );
    },
    h3: ({ children, ...props }: any) => {
      const id = getHeadingId(children);
      return (
        <h3
          id={id}
          className="text-2xl font-semibold text-markdown-heading mb-4 mt-6 scroll-mt-20"
          {...props}
        >
          {children}
        </h3>
      );
    },
    h4: ({ children, ...props }: any) => {
      const id = getHeadingId(children);
      return (
        <h4
          id={id}
          className="text-xl font-semibold text-markdown-heading mb-3 mt-5 scroll-mt-20"
          {...props}
        >
          {children}
        </h4>
      );
    },
    h5: ({ children, ...props }: any) => {
      const id = getHeadingId(children);
      return (
        <h5
          id={id}
          className="text-lg font-semibold text-markdown-heading mb-3 mt-4 scroll-mt-20"
          {...props}
        >
          {children}
        </h5>
      );
    },
    h6: ({ children, ...props }: any) => {
      const id = getHeadingId(children);
      return (
        <h6
          id={id}
          className="text-base font-semibold text-markdown-heading mb-2 mt-4 scroll-mt-20"
          {...props}
        >
          {children}
        </h6>
      );
    },
    p: ({ children }) => (
      <p className="mb-4 leading-relaxed text-[17px] break-words">{children}</p>
    ),
    a: ({ href, children, ...props }: any) => {
      // Check if it's an anchor link (starts with #)
      const isAnchorLink = href?.startsWith("#");
      const isInternalAnchor = href?.startsWith("#") && !href.startsWith("#!");

      if (isInternalAnchor) {
        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              const id = href.slice(1);

              // Update URL first
              window.history.pushState(null, "", href);

              // Scroll immediately - element should already be in DOM
              const element = document.getElementById(id);
              if (element) {
                // Use scrollIntoView for better browser optimization
                // The scroll-mt-20 class handles the offset automatically
                element.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }
            }}
            className="text-markdown-link hover:text-markdown-linkHover underline decoration-2 underline-offset-2 transition-colors"
            {...props}
          >
            {children}
          </a>
        );
      }

      // External links
      return (
        <a
          href={href}
          className="text-markdown-link hover:text-markdown-linkHover underline decoration-2 underline-offset-2 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    code: ({ inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || "");
      return !inline && match ? (
        <div className="my-6 rounded-lg overflow-hidden border border-border overflow-x-auto">
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match[1]}
            PreTag="div"
            className="!my-0 !rounded-lg"
            {...props}
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code
          className="bg-markdown-codeBg text-markdown-codeText px-2 py-0.5 rounded text-[15px] font-mono break-all"
          {...props}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }) => <pre className="my-0">{children}</pre>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-markdown-blockquoteBorder bg-markdown-blockquoteBg pl-4 pr-4 py-2 my-6 italic">
        {children}
      </blockquote>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-outside ml-6 mb-4 space-y-2">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside ml-6 mb-4 space-y-2">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    table: ({ children }) => (
      <div className="my-6 overflow-x-auto">
        <table className="w-full border-collapse border border-markdown-tableBorder">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
    th: ({ children }) => (
      <th className="border border-markdown-tableBorder px-4 py-2 text-left font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-markdown-tableBorder px-4 py-2">
        {children}
      </td>
    ),
    hr: () => <hr className="my-8 border-border" />,
    img: ({ src, alt }) => (
      <img src={src} alt={alt} className="max-w-full h-auto rounded-lg my-6" />
    ),
  };

  return (
    <article className="markdown-content font-sans text-markdown-text break-words max-w-full">
      {segments.map((segment, index) => {
        if (segment.type === "annotation") {
          // Calculate section index (number of annotation forms before this one)
          const sectionIndex =
            segments.slice(0, index).filter((s) => s.type === "annotation")
              .length + 1;
          return (
            <AnnotationForm
              key={`annotation-${index}`}
              url={url}
              sectionIndex={sectionIndex}
            />
          );
        }
        return (
          <ReactMarkdown
            key={`markdown-${index}`}
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {segment.content}
          </ReactMarkdown>
        );
      })}
    </article>
  );
};
