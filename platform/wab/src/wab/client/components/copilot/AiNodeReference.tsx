import React from "react";
import styles from "./AiNodeReference.module.less";
import { useI18n } from "@/wab/client/i18n";
import type { AiTask } from "@/wab/shared/copilot/ai-chat";
import { AimOutlined, BlockOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";

export type AiNode = NonNullable<AiTask["nodes"]>[number];

export function AiNodeReference({
  node,
  onLocate,
}: {
  node: AiNode;
  onLocate?: (node: AiNode) => void;
}) {
  const { t } = useI18n();

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
