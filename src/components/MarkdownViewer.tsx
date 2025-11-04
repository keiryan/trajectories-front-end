import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { AnnotationForm } from "./AnnotationForm";
import { useEffect, useRef, useMemo, useCallback } from "react";

interface Task {
  id: string;
  fields: {
    "Task Number"?: string;
    "Annotation Notes"?: string;
    [key: string]: any;
  };
}

interface MarkdownViewerProps {
  content: string;
  url?: string;
  selectedTask?: Task;
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

  if (!content || typeof content !== 'string') {
    return anchorMap;
  }

  // Parse line by line to find anchor tags followed by headings
  const lines = content.split("\n");

  const findNextHeadingLine = (startIndex: number): string | undefined => {
    let currentIndex = startIndex;

    while (currentIndex < lines.length) {
      const trimmedLine = lines[currentIndex].trim();

      if (trimmedLine === "") {
        currentIndex++;
        continue;
      }

      if (trimmedLine.startsWith("<!--")) {
        // Skip entire HTML comment blocks (which may span multiple lines)
        while (currentIndex < lines.length) {
          const commentLine = lines[currentIndex].trim();
          currentIndex++;
          if (commentLine.includes("-->")) {
            break;
          }
        }
        continue;
      }

      return trimmedLine;
    }

    return undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    // Look for anchor tag on current line or combined with next line
    const currentLine = lines[i].trim();
    const anchorMatch = currentLine.match(/<a\s+id=["']([^"']+)["']\s*><\/a>/i);

    if (anchorMatch) {
      const anchorId = anchorMatch[1];
      // Check following lines (skipping optional blank lines and comments) for the heading
      const nextLine = findNextHeadingLine(i + 1);
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
        /<a\s+id=["']([^"']+)["']\s*><\/a>\s*(#{1,6})\s+(.+)/i
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

export const MarkdownViewer = ({ content, url, selectedTask }: MarkdownViewerProps) => {
  // Extract anchor IDs from the content - memoized
  const anchorIds = useMemo(() => {
    if (!content || typeof content !== 'string') return new Map<string, string>();
    return extractAnchorIds(content);
  }, [content]);
  
  const articleRef = useRef<HTMLElement>(null);

  // Helper to extract task number from URL
  const extractTaskNumberFromUrl = useCallback((url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      const fileName = pathParts[pathParts.length - 1];
      const match = fileName.match(/^(\d+)\.md$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }, []);

  // Parse Annotation Notes and organize by section index - memoized
  const annotationDataBySection = useMemo((): Record<number, Record<string, any>> => {
    const sectionData: Record<number, Record<string, any>> = {};
    
    if (!selectedTask?.fields["Annotation Notes"]) {
      return sectionData;
    }

    try {
      const annotationNotesStr = selectedTask.fields["Annotation Notes"];
      let annotationNotes: Record<string, any> = {};
      
      if (typeof annotationNotesStr === "string") {
        annotationNotes = JSON.parse(annotationNotesStr);
      } else if (typeof annotationNotesStr === "object") {
        annotationNotes = annotationNotesStr;
      }

      // Extract task number from URL or selected task
      const taskNumber = selectedTask?.fields["Task Number"] || 
        (url ? extractTaskNumberFromUrl(url) : null);

      if (!taskNumber) {
        return sectionData;
      }

      // Parse keys in format: {taskNumber}_{sectionIndex}_{fieldName}
      Object.entries(annotationNotes).forEach(([key, value]) => {
        const pattern = new RegExp(`^${taskNumber}_(\\d+)_(.+)$`);
        const match = key.match(pattern);
        
        if (match) {
          const sectionIndex = parseInt(match[1], 10);
          const fieldName = match[2];
          
          if (!sectionData[sectionIndex]) {
            sectionData[sectionIndex] = {};
          }
          
          sectionData[sectionIndex][fieldName] = value;
        }
      });
    } catch (error) {
      console.warn("Failed to parse Annotation Notes:", error);
    }

    return sectionData;
  }, [selectedTask, url, extractTaskNumberFromUrl]);

  // Pre-process content to remove all anchor tags (they'll be handled by heading IDs) - memoized
  const processedContent = useMemo(() => {
    if (!content || typeof content !== 'string') {
      return '';
    }
    
    // Remove all anchor tags completely - match both <a id="..."></a> and <a id="..."/> formats
    // Handles single/double quotes, optional whitespace, and optional newlines
    return content.replace(/<a\s+id=["'][^"']+["']\s*(?:\/>|><\/a>)\s*\n?/gi, "");
  }, [content]);

  // Split processed content by <!-- MD ... --> comments and create segments - memoized
  const segments = useMemo(() => {
    if (!processedContent || typeof processedContent !== 'string') {
      return [{ type: "markdown" as const, content: "" }];
    }
    
    const mdCommentRegex = /<!--\s*MD[\s\S]*?-->/gi;
    const segmentsArray: Array<{ type: "markdown" | "annotation"; content: string }> = [];

    let lastIndex = 0;
    let match;

    while ((match = mdCommentRegex.exec(processedContent)) !== null) {
      // Add markdown before the comment
      if (match.index > lastIndex) {
        segmentsArray.push({
          type: "markdown",
          content: processedContent.substring(lastIndex, match.index),
        });
      }

      // Add annotation form placeholder
      segmentsArray.push({
        type: "annotation",
        content: "",
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining markdown
    if (lastIndex < processedContent.length) {
      segmentsArray.push({
        type: "markdown",
        content: processedContent.substring(lastIndex),
      });
    }

    // If no comments found, just render the full content
    if (segmentsArray.length === 0) {
      segmentsArray.push({
        type: "markdown",
        content: processedContent,
      });
    }

    return segmentsArray;
  }, [processedContent]);

  // Create a helper to get ID for a heading - defined before markdownComponents
  const getHeadingId = useCallback((children: any, defaultId?: string): string => {
    // First check if there's an explicit anchor ID mapped
    const textKey = generateId(children);
    if (anchorIds.has(textKey)) {
      return anchorIds.get(textKey)!;
    }
    // Otherwise use the default generated ID or provided default
    return defaultId || textKey;
  }, [anchorIds]);


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

  // Memoize markdownComponents to prevent recreation on every render
  const markdownComponents = useMemo(() => ({
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
  }), [anchorIds]);

  return (
    <article ref={articleRef} className="markdown-content font-sans text-markdown-text break-words max-w-full">
        {segments.map((segment, index) => {
        if (segment.type === "annotation") {
          // Calculate section index (number of annotation forms before this one)
          const sectionIndex =
            segments.slice(0, index).filter((s) => s.type === "annotation")
              .length + 1;
          // Use memoized annotation data to prevent unnecessary resets
          const prefilledData = annotationDataBySection[sectionIndex] || {};
          return (
            <div data-annotation-section={sectionIndex}>
              <AnnotationForm
                key={`annotation-${sectionIndex}-${url || ''}`}
                url={url}
                sectionIndex={sectionIndex}
                prefilledData={prefilledData}
                selectedTask={selectedTask}
              />
            </div>
          );
        }
        return (
          <ReactMarkdown
            key={`markdown-${index}-${segment.content.substring(0, 20)}`}
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
