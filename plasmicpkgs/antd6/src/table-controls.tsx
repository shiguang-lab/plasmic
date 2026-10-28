import type { CustomControlProps } from "@plasmicapp/host";
import { Checkbox, Input, Tooltip, type CheckboxProps } from "antd";
import React from "react";

// StudioControlsProvider supplies the editor theme and target document styles.
const rowStyle: React.CSSProperties = {
  display: "flex",
  minHeight: 32,
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};
const inputStyle: React.CSSProperties = {
  width: 120,
  minWidth: 0,
  flexShrink: 0,
};
const checkboxStyles: CheckboxProps["styles"] = {
  root: {
    ...rowStyle,
    flexDirection: "row-reverse",
    gap: 0,
    font: "inherit",
  },
  label: { flex: 1, paddingInlineStart: 0, paddingInlineEnd: 8 },
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
    if (next == null) {
      delete result[key];
    } else {
      result[key] = next;
    }
    updateValue(result);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <Checkbox
        styles={checkboxStyles}
        checked={value !== false}
        onChange={(e) =>
          updateValue(e.target.checked ? { ...options } : false)
        }
      >
        Show pagination
      </Checkbox>
      {value !== false && (
        <>
          <label style={rowStyle}>
            Page size{" "}
            <Input
              type="number"
              style={inputStyle}
              aria-label="Page size"
              min={1}
              step={1}
              value={options.pageSize ?? options.defaultPageSize ?? ""}
              placeholder="10"
              onChange={(e) => {
                if (!e.target.validity.valid) {
                  return;
                }
                update(
                  options.pageSize !== undefined
                    ? "pageSize"
                    : "defaultPageSize",
                  e.target.value === "" ? null : Number(e.target.value),
                );
              }}
            />
          </label>
          <Checkbox
            styles={checkboxStyles}
            checked={
              options.showSizeChanger ??
              (options.total ?? componentProps?.data?.data?.length ?? 0) > 50
            }
            onChange={(e) => update("showSizeChanger", e.target.checked)}
          >
            Show size changer
          </Checkbox>
          <Checkbox
            styles={checkboxStyles}
            checked={options.showQuickJumper ?? false}
            onChange={(e) => update("showQuickJumper", e.target.checked)}
          >
            Show quick jumper
          </Checkbox>
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
    if (next == null || next === "") {
      delete result[key];
    } else {
      result[key] = next;
    }
    updateValue(result);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <label style={rowStyle}>
        <Tooltip title="Horizontal scroll width in pixels, a percentage, or max-content. Leave empty to fit the container without horizontal scrolling.">
          <span>x</span>
        </Tooltip>
        <Input
          type="text"
          style={inputStyle}
          aria-label="scroll.x"
          value={options.x ?? ""}
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
        <Tooltip title="Table body height in pixels. Leave empty to grow with content.">
          <span>y</span>
        </Tooltip>
        <Input
          type="number"
          style={inputStyle}
          aria-label="scroll.y"
          min={1}
          value={options.y ?? ""}
          onChange={(e) => {
            if (!e.target.validity.valid) {
              return;
            }
            update("y", e.target.value === "" ? null : Number(e.target.value));
          }}
        />
      </label>
    </div>
  );
}
