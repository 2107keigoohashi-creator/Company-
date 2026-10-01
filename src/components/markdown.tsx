import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** 成果物表示。生 HTML は描画しない(react-markdown の既定)。 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
