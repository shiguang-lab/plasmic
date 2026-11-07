import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { useModelSelector } from "./model-selector";
import { modelKeys } from "./revisions";
import { useStudioShell } from "./studio-stores";

interface Tpl {
  uuid: string;
  name: string;
  /** 其他字段存在，但本组件不读，因此不该因为它变化而重渲染 */
  props: Record<string, unknown>;
}

/**
 * 迁移后的组件形态（对照设计文档 4.1 / 4.2 / 5.4）：
 *
 * ① React 状态：一次读多个字段 -> useShallow
 * ② 模型数据：按修订号记忆化 -> 引用稳定，不需要 equality
 * ③ 不再需要 observer
 */
export function StudioPanel({ tpl }: { tpl: Tpl }): React.ReactElement {
  const { leftPanel, rightTabKey } = useStudioShell(
    useShallow((state) => ({
      leftPanel: state.leftPanel,
      rightTabKey: state.rightTabKey,
    })),
  );

  const displayName = useModelSelector(
    [modelKeys.tpl(tpl.uuid)],
    () => tpl.name || "(unnamed)",
  );

  return (
    <div data-panel={leftPanel ?? "none"} data-tab={rightTabKey ?? "-"}>
      {displayName}
    </div>
  );
}
