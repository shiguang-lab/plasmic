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
  tpl: TplNode | SlotSelection;
  viewCtx: ViewCtx;
}) {
  const path = selectionPath(viewCtx, tpl);
  const shared = path.some(
    (part) => part.scope === "shared-template" || part.repeated,
  );
  const val = viewCtx.focusedSelectable();
  const instance =
    val && !(val instanceof SlotSelection) && !(tpl instanceof SlotSelection)
      ? viewCtx.renderState.tpl2fullKeys(tpl).indexOf(val.fullKey)
      : -1;
  const select = (part: (typeof path)[number]) =>
    viewCtx.change(() =>
      part.node instanceof SlotSelection
        ? viewCtx.setStudioFocusBySelectable(part.node)
        : viewCtx.setStudioFocusByTpl(part.node, viewCtx.focusedCloneKey()),
    );
  const button = (part: (typeof path)[number], current = false) => (
    <button
      key={`${part.elementUuid}-${part.slotName ?? "element"}`}
      type="button"
      aria-current={current ? "location" : undefined}
      aria-label={`选择 ${part.label}`}
      title={part.label}
      style={{
        border: 0,
        background: "transparent",
        color: "#1677ff",
        cursor: "pointer",
        padding: "2px 0",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      onClick={() => select(part)}
    >
      {part.label}
    </button>
  );
  const middle = path.length > 3 ? path.slice(1, -2) : [];
  const visible = middle.length ? [path[0], ...path.slice(-2)] : path;
  return (
    <div
      style={{ padding: "8px 16px", borderBottom: "1px solid #ddd" }}
      data-test-id="selection-path"
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "baseline",
          color: "#777",
          fontSize: 11,
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
          title={viewCtx.currentComponent().name}
        >
          正在编辑：{viewCtx.currentComponent().name}
        </span>
        <details style={{ flexShrink: 0 }}>
          <summary style={{ cursor: "pointer" }}>选择帮助</summary>
          <div>
            双击 / Enter 进入下一层 · Shift+Enter 返回父层 ·
            Cmd/Ctrl+单击选择内部元素
          </div>
        </details>
      </div>
      <nav
        aria-label="元素编辑路径"
        style={{ display: "flex", alignItems: "baseline", gap: 4 }}
      >
        {visible.map((part, index) => (
          <React.Fragment
            key={`${part.elementUuid}-${part.slotName ?? "element"}`}
          >
            {index > 0 && <span aria-hidden>›</span>}
            {index === 1 && middle.length > 0 && (
              <>
                <details>
                  <summary
                    aria-label="展开完整编辑路径"
                    title={path.map((p) => p.label).join(" › ")}
                    style={{ cursor: "pointer" }}
                  >
                    …
                  </summary>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                    }}
                  >
                    {middle.map((p) => button(p))}
                  </div>
                </details>
                <span aria-hidden>›</span>
              </>
            )}
            {button(part, index === visible.length - 1)}
          </React.Fragment>
        ))}
      </nav>
      {shared && (
        <div style={{ fontSize: 11, marginTop: 4 }}>
          共享模板：修改会作用于所有实例。
          {instance >= 0 ? `当前第 ${instance + 1} 项。` : ""}
        </div>
      )}
    </div>
  );
});
