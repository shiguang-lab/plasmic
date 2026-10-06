import { selectionPath } from "@/wab/client/selection-context";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { SlotSelection } from "@/wab/shared/core/slots";
import type { TplNode } from "@/wab/shared/model/classes";
import { observer } from "mobx-react";
import React from "react";

export const SelectionPath = observer(function SelectionPath({
  tpl,
  viewCtx,
}: {
  tpl: TplNode;
  viewCtx: ViewCtx;
}) {
  const path = selectionPath(viewCtx, tpl);
  const shared = path.some(
    (part) =>
      part.scope === "shared-template" || part.scope === "repeated-template",
  );
  const val = viewCtx.focusedSelectable();
  const instance =
    val && !(val instanceof SlotSelection)
      ? viewCtx.renderState.tpl2fullKeys(tpl).indexOf(val.fullKey)
      : -1;
  return (
    <div
      style={{ padding: "12px 16px", borderBottom: "1px solid #ddd" }}
      data-test-id="selection-path"
    >
      <div style={{ marginBottom: 6, color: "#777" }}>
        正在编辑：{viewCtx.currentComponent().name}
      </div>
      <nav
        aria-label="元素编辑路径"
        style={{ display: "flex", flexWrap: "wrap", gap: 4 }}
      >
        {path.map((part, index) => (
          <React.Fragment key={`${part.elementUuid}-${index}`}>
            {index > 0 && <span aria-hidden>›</span>}
            <button
              type="button"
              aria-current={index === path.length - 1 ? "location" : undefined}
              aria-label={`选择 ${part.label}`}
              title={`选择 ${part.label}`}
              style={{
                border: 0,
                background: "transparent",
                color: "#1677ff",
                cursor: "pointer",
                padding: "2px 0",
              }}
              onClick={() =>
                viewCtx.change(() =>
                  part.node instanceof SlotSelection
                    ? viewCtx.setStudioFocusBySelectable(part.node)
                    : viewCtx.setStudioFocusByTpl(
                        part.node,
                        viewCtx.focusedCloneKey(),
                      ),
                )
              }
            >
              {part.label}
              {part.scope === "shared-template"
                ? "（所有行共享）"
                : part.scope === "repeated-template"
                  ? "（重复模板）"
                  : ""}
            </button>
          </React.Fragment>
        ))}
      </nav>
      {shared && (
        <div style={{ marginTop: 6 }}>
          修改会作用于所有重复实例。
          {instance >= 0 ? `当前预览：第 ${instance + 1} 个实例。` : ""}
        </div>
      )}
      <div style={{ color: "#777", fontSize: 11, marginTop: 6 }}>
        双击 / Enter 进入下一层 · Shift+Enter 返回父层 ·
        Cmd/Ctrl+单击选择内部元素
      </div>
    </div>
  );
});
