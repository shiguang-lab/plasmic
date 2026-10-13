import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Button } from "antd";
import { useI18n } from "@/wab/client/i18n";

export function AiMarkdown({ children: markdown }: { children: string }) {
  const { t } = useI18n();
  return <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ href,children }) => href && /^(https?:|mailto:|\/|#)/i.test(href)
      ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
      : <span>{children}</span>,
    img: ({ alt }) => <span>{alt}</span>,
    pre: ({ children }) => {
      const code = React.Children.toArray(children).find(React.isValidElement);
      const text = code && React.isValidElement<{ children?: React.ReactNode }>(code) ? String(code.props.children ?? "") : "";
      return <div><Button size="small" onClick={() => void navigator.clipboard.writeText(text)}>{t("Copy")}</Button><Scrollbar style={{ maxHeight: 300 }} scrollX={false}><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{children}</pre></Scrollbar></div>;
    },
    table: ({ children }) => <Scrollbar style={{ maxWidth: "100%" }} scrollY={false}><table>{children}</table></Scrollbar>,
  }}>{markdown}</ReactMarkdown>;
}
