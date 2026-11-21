import styles from "./AiMarkdownContent.module.less";
import {
  AiNodeReference,
  type AiNode,
} from "@/wab/client/components/copilot/AiNodeReference";
import { Modal } from "@/wab/client/components/widgets/Modal";
import { useI18n } from "@/wab/client/i18n";
import { FullscreenOutlined } from "@ant-design/icons";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import XMarkdown from "@shiguang2/components/esm/x-markdown";
import Highlighter from "@shiguang2/components/esm/x-markdown/components/Highlighter";
import type { ComponentProps } from "@shiguang2/components/esm/x-markdown/interface";
import { copyToClipboard } from "@shiguang2/components/esm/x-markdown/utils/clipboard";
import { Button, Tooltip, theme as AntdTheme } from "antd";
import React from "react";

const NodeContext = React.createContext<{
  nodes: AiNode[];
  onLocate?: (node: AiNode) => void;
}>({ nodes: [] });

function CodeBlock({ children, block, lang, rawText }: ComponentProps) {
  const { t } = useI18n();

  const { token } = AntdTheme.useToken();
  const [copied, setCopied] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const { nodes, onLocate } = React.useContext(NodeContext);
  const text = rawText ?? (typeof children === "string" ? children : "");
  if (!block) {
    const node = nodes.find((item) => item.uuid === text || item.name === text);
    return node ? (
      <AiNodeReference node={node} onLocate={onLocate} />
    ) : (
      <code>{children}</code>
    );
  }
  const palette = {
    "--highlighter-text-color": token.colorText,
    "--highlighter-punctuation": token.colorTextSecondary,
    "--highlighter-comment": token.colorTextTertiary,
    "--highlighter-keyword": token.colorPrimaryText,
    "--highlighter-string": token.colorSuccessText,
    "--highlighter-number": token.colorWarningText,
    "--highlighter-function": token.colorInfoText,
    "--highlighter-property": token.colorErrorText,
  } as React.CSSProperties;
  const highlight = (
    <Highlighter
      language={lang}
      showLineNumbers
      showInlineLineNumbers
      lineNumberStyle={{
        fontSize: 12,
        lineHeight: 1.6,
        paddingRight: "1em",
        minWidth: "2.5em",
        color: token.colorTextTertiary,
        userSelect: "none",
      }}
      wrapLongLines={false}
      codeTagProps={{
        style: { fontSize: 12, lineHeight: 1.6, whiteSpace: "pre", padding: 0 },
      }}
      customStyle={{
        margin: 0,
        padding: 12,
        fontSize: 12,
        lineHeight: 1.6,
        background: "transparent",
        overflow: "visible",
        whiteSpace: "pre",
      }}
    >
      {text}
    </Highlighter>
  );
  return (
    <div
      className={styles.codeBlock}
      style={palette}
      data-test-id="ai-code-block"
    >
      <div className={styles.codeHeader}>
        <span>{lang || "plaintext"}</span>
        <div className={styles.codeActions}>
          <Button
            size="small"
            type="text"
            onClick={() => setCopied(copyToClipboard(text))}
          >
            {t(copied ? "Copied" : "Copy")}
          </Button>
          <Tooltip title={t("Fullscreen")}>
            <Button
              size="small"
              type="text"
              aria-label={t("Fullscreen")}
              icon={<FullscreenOutlined />}
              onClick={() => setFullscreen(true)}
            />
          </Tooltip>
        </div>
      </div>
      <Scrollbar className={styles.codeScroll} defer={false}>
        {highlight}
      </Scrollbar>
      <Modal
        open={fullscreen}
        title={lang || "plaintext"}
        footer={null}
        width="min(1000px, 90vw)"
        onCancel={() => setFullscreen(false)}
        destroyOnHidden
      >
        <Scrollbar className={styles.fullscreen} style={palette} defer={false}>
          {highlight}
        </Scrollbar>
      </Modal>
    </div>
  );
}

function MarkdownLink({ href, children }: ComponentProps<{ href?: string }>) {
  const { nodes, onLocate } = React.useContext(NodeContext);
  if (href?.startsWith("#plasmic-node/")) {
    const uuid = href.slice("#plasmic-node/".length);
    const node =
      nodes.find((item) => item.uuid === uuid) ??
      (/^[\w-]+$/.test(uuid)
        ? {
            uuid,
            name: typeof children === "string" ? children : uuid,
            page: null,
            branch: null,
          }
        : undefined);
    return node ? (
      <AiNodeReference node={node} onLocate={onLocate} />
    ) : (
      <span>{children}</span>
    );
  }
  return href && /^(https?:|mailto:|\/|#)/i.test(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}
function MarkdownTable({ children }: ComponentProps) {

  return (
    <Scrollbar className={styles.tableScroll} scrollY={false} defer={false}>
      <table>{children}</table>
    </Scrollbar>
  );
}
function ImageLabel({ alt }: ComponentProps<{ alt?: string }>) {
  return <span>{alt}</span>;
}
function MarkdownPre({ children }: ComponentProps) {
  return <>{children}</>;
}
const components = {
  pre: MarkdownPre,
  code: CodeBlock,
  a: MarkdownLink,
  table: MarkdownTable,
  img: ImageLabel,
};

export function AiMarkdown({
  children,
  running = false,
  nodes = [],
  onLocate,
  compact = false,
}: AiMarkdownProps) {

  const context = React.useMemo(() => ({ nodes, onLocate }), [nodes, onLocate]);
  return (
    <NodeContext.Provider value={context}>
      <div data-test-id="ai-markdown">
        <XMarkdown
          rootClassName={`${styles.markdown} ${compact ? styles.compact : ""}`}
          components={components}
          paragraphTag="p"
          hasNextChunk={running}
          escapeRawHtml
        >
          {children}
        </XMarkdown>
      </div>
    </NodeContext.Provider>
  );
}

export interface AiMarkdownProps {
  children: string;
  running?: boolean;
  nodes?: AiNode[];
  onLocate?: (node: AiNode) => void;
  compact?: boolean;
}
