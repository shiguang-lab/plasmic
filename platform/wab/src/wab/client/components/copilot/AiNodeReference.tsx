import { useI18n } from "@/wab/client/i18n";
import type { AiTask } from "@/wab/shared/copilot/ai-chat";
import { AimOutlined, BlockOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { createStyles } from "antd-style";
import React from "react";

export type AiNode = NonNullable<AiTask["nodes"]>[number];
const useStyles = createStyles(({ token }) => ({
  node: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
    verticalAlign: "middle",
    padding: "2px 7px",
    borderRadius: token.borderRadiusSM,
    border: `1px solid ${token.colorPrimaryBorder}`,
    background: token.colorPrimaryBg,
    color: token.colorPrimaryText,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: "20px",
    cursor: "pointer",
    fontFamily: token.fontFamily,
    "& span[data-node-name]": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& svg": { flexShrink: 0 },
    "&:hover": { background: token.colorPrimaryBgHover },
    "&:focus-visible": {
      outline: `2px solid ${token.colorPrimary}`,
      outlineOffset: 2,
    },
    "&:disabled": { cursor: "default", opacity: 0.65 },
  },
}));

export function AiNodeReference({
  node,
  onLocate,
}: {
  node: AiNode;
  onLocate?: (node: AiNode) => void;
}) {
  const { t } = useI18n();
  const { styles } = useStyles();
  return (
    <Tooltip
      title={
        <span>
          {t("Locate node {name}", { name: node.name })}
          <br />
          <code>{node.uuid}</code>
        </span>
      }
    >
      <button
        type="button"
        className={styles.node}
        disabled={!onLocate}
        aria-label={t("Locate node {name}", { name: node.name })}
        data-test-id="ai-node-reference"
        data-node-uuid={node.uuid}
        onClick={() => onLocate?.(node)}
      >
        <BlockOutlined />
        <span data-node-name="">{node.name}</span>
        <AimOutlined />
      </button>
    </Tooltip>
  );
}
