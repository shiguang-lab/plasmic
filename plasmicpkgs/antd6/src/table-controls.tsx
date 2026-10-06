import type { CustomControlProps } from "@plasmicapp/host";
import React from "react";

// Controls are portaled into Studio's document; use native inputs with local styles.
const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};
const inputStyle: React.CSSProperties = {
  appearance: "auto",
  width: 120,
  minWidth: 0,
  height: 26,
  border: "1px solid #ddd",
  borderRadius: 4,
  padding: "2px 6px",
  boxSizing: "border-box",
  background: "white",
  color: "#333",
  font: "inherit",
};
const checkboxStyle: React.CSSProperties = {
  appearance: "auto",
  width: 16,
  height: 16,
  accentColor: "#1677ff",
};

/** Edits the real pagination prop, preserving options not exposed by these controls. */
export function TablePaginationControl({
  value,
  updateValue,
  componentProps,
}: CustomControlProps<any>) {
  const options = value && typeof value === "object" ? value : {};
  const update = (key: string, next: unknown) => {
    const result = { ...options };
    if (next == null) delete result[key];
    else result[key] = next;
    updateValue(result);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={rowStyle}>
        显示分页{" "}
        <input
          type="checkbox"
          style={checkboxStyle}
          aria-label="显示分页"
          checked={value !== false}
          onChange={(e) =>
            updateValue(e.target.checked ? { ...options } : false)
          }
        />
      </label>
      {value !== false && (
        <>
          <label style={rowStyle}>
            每页条数{" "}
            <input
              type="number"
              style={inputStyle}
              aria-label="每页条数"
              min={1}
              step={1}
              value={options.pageSize ?? options.defaultPageSize ?? ""}
              placeholder="10"
              onChange={(e) => {
                if (!e.target.validity.valid) return;
                update(
                  options.pageSize !== undefined
                    ? "pageSize"
                    : "defaultPageSize",
                  e.target.value === "" ? null : Number(e.target.value),
                );
              }}
            />
          </label>
          <label style={rowStyle}>
            可切换每页条数{" "}
            <input
              type="checkbox"
              style={checkboxStyle}
              aria-label="可切换每页条数"
              checked={
                options.showSizeChanger ??
                (options.total ?? componentProps?.data?.data?.length ?? 0) > 50
              }
              onChange={(e) => update("showSizeChanger", e.target.checked)}
            />
          </label>
          <label style={rowStyle}>
            快速跳页{" "}
            <input
              type="checkbox"
              style={checkboxStyle}
              aria-label="快速跳页"
              checked={options.showQuickJumper ?? false}
              onChange={(e) => update("showQuickJumper", e.target.checked)}
            />
          </label>
        </>
      )}
    </div>
  );
}

export function TableScrollControl({
  value,
  updateValue,
}: CustomControlProps<any>) {
  const options = value && typeof value === "object" ? value : {};
  const update = (key: string, next: unknown) => {
    const result = { ...options };
    if (next == null || next === "") delete result[key];
    else result[key] = next;
    updateValue(result);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={rowStyle}>
        水平滚动宽度{" "}
        <input
          type="text"
          style={inputStyle}
          aria-label="水平滚动宽度"
          value={options.x ?? ""}
          placeholder="自动适应内容"
          onChange={(e) => {
            const text = e.target.value.trim();
            update(
              "x",
              text && Number.isFinite(Number(text)) ? Number(text) : text,
            );
          }}
        />
      </label>
      <label style={rowStyle}>
        表体最大高度{" "}
        <input
          type="number"
          style={inputStyle}
          aria-label="表体最大高度"
          min={1}
          value={options.y ?? ""}
          placeholder="随内容增长"
          onChange={(e) => {
            if (!e.target.validity.valid) return;
            update("y", e.target.value === "" ? null : Number(e.target.value));
          }}
        />
      </label>
    </div>
  );
}
