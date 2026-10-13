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
import { Button, Tooltip, theme } from "antd";
import { createStyles } from "antd-style";
import React from "react";

const useStyles = createStyles(({ token }) => ({
  markdown: {
    "&&": { "--font-size": "13px", fontSize: 13, lineHeight: 1.7 },
    minWidth: 0,
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1.7,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    color: token.colorText,
    "& > :first-child": { marginTop: 0 },
    "& > :last-child": { marginBottom: 0 },
    "&& p, && [data-component=paragraph]": {
      margin: "0 0 10px",
      whiteSpace: "normal",
    },
    "&& h1, && h2, && h3, && h4, && h5, && h6": {
      margin: "16px 0 8px",
      fontWeight: 600,
      lineHeight: 1.4,
    },
    "&& h1": { fontSize: 18 },
    "&& h2": { fontSize: 16 },
    "&& h3, && h4, && h5, && h6": { fontSize: 14 },
    "& strong": { fontWeight: 600 },
    "&& ul, && ol": { margin: "8px 0 12px", paddingLeft: 22 },
    "& ul": { listStyleType: "disc" },
    "& ol": { listStyleType: "decimal" },
    "&& li": { paddingLeft: 2, margin: "4px 0" },
    "&& li > p": { marginBottom: 4 },
    "&& li > ul, && li > ol": { margin: "4px 0" },
    "&& blockquote": {
      margin: "12px 0",
      padding: "4px 12px",
      borderLeft: `3px solid ${token.colorBorder}`,
      color: token.colorTextSecondary,
    },
    "&& blockquote > p:last-child": { marginBottom: 0 },
    "&& a": {
      color: token.colorLink,
      textDecoration: "underline",
      textUnderlineOffset: 3,
    },
    "&& code": { fontFamily: token.fontFamilyCode, fontSize: 12 },
    "&& :not(pre) > code": {
      padding: "2px 5px",
      borderRadius: 4,
      background: token.colorFillSecondary,
    },
    "&& pre": {
      margin: 0,
      padding: 12,
      whiteSpace: "pre",
      overflowWrap: "normal",
      lineHeight: 1.6,
    },
    "&& pre code": { padding: 0, background: "transparent" },
    "&& table": { borderCollapse: "collapse", width: "100%", fontSize: 12 },
    "&& th, && td": {
      border: `1px solid ${token.colorBorderSecondary}`,
      padding: "7px 10px",
      minWidth: 80,
    },
    "&& th": { background: token.colorFillSecondary, fontWeight: 600 },
    "&& hr": {
      border: 0,
      borderTop: `1px solid ${token.colorBorderSecondary}`,
      margin: "16px 0",
    },
  },
  codeBlock: {
    margin: "12px 0",
    minWidth: 0,
    overflow: "hidden",
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadius,
    background: token.colorFillQuaternary,
  },
  codeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 8px 4px 12px",
    fontSize: 11,
    color: token.colorTextSecondary,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  },
  codeScroll: {
    maxHeight: 300,
    maxWidth: "100%",
    "& pre": { overflow: "visible" },
  },
  codeActions: { display: "flex", alignItems: "center", gap: 4 },
  fullscreen: {
    height: "min(70dvh, 800px)",
    minHeight: 0,
    "& pre": { overflow: "visible" },
  },
  tableScroll: { maxWidth: "100%", margin: "12px 0" },
}));

const NodeContext = React.createContext<{
  nodes: AiNode[];
  onLocate?: (node: AiNode) => void;
}>({ nodes: [] });

function CodeBlock({ children, block, lang, rawText }: ComponentProps) {
  const { t } = useI18n();
  const { styles } = useStyles();
  const { token } = theme.useToken();
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
  const { styles } = useStyles();
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
}: {
  children: string;
  running?: boolean;
  nodes?: AiNode[];
  onLocate?: (node: AiNode) => void;
}) {
  const { styles } = useStyles();
  const context = React.useMemo(() => ({ nodes, onLocate }), [nodes, onLocate]);
  return (
    <NodeContext.Provider value={context}>
      <div data-test-id="ai-markdown">
        <XMarkdown
          rootClassName={styles.markdown}
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
