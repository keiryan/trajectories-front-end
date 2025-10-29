import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { AnnotationForm } from "./AnnotationForm";

interface MarkdownViewerProps {
  content: string;
  url?: string;
}

export const MarkdownViewer = ({ content, url }: MarkdownViewerProps) => {
  // Split content by <!-- MD ... --> comments and create segments
  const mdCommentRegex = /<!--\s*MD[\s\S]*?-->/gi;
  const segments: Array<{ type: "markdown" | "annotation"; content: string }> =
    [];

  let lastIndex = 0;
  let match;

  while ((match = mdCommentRegex.exec(content)) !== null) {
    // Add markdown before the comment
    if (match.index > lastIndex) {
      segments.push({
        type: "markdown",
        content: content.substring(lastIndex, match.index),
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
  if (lastIndex < content.length) {
    segments.push({
      type: "markdown",
      content: content.substring(lastIndex),
    });
  }

  // If no comments found, just render the full content
  if (segments.length === 0) {
    segments.push({
      type: "markdown",
      content: content,
    });
  }

  const markdownComponents = {
    h1: ({ children }) => (
      <h1 className="text-4xl font-bold text-markdown-heading mb-6 mt-8 first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-3xl font-bold text-markdown-heading mb-5 mt-7 border-b border-border pb-2">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-2xl font-semibold text-markdown-heading mb-4 mt-6">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-xl font-semibold text-markdown-heading mb-3 mt-5">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="text-lg font-semibold text-markdown-heading mb-3 mt-4">
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className="text-base font-semibold text-markdown-heading mb-2 mt-4">
        {children}
      </h6>
    ),
    p: ({ children }) => (
      <p className="mb-4 leading-relaxed text-[17px] break-words">{children}</p>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-markdown-link hover:text-markdown-linkHover underline decoration-2 underline-offset-2 transition-colors"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
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
    <article className="markdown-content font-serif text-markdown-text break-words max-w-full">
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
