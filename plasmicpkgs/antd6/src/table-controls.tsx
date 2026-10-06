import type { CustomControlProps } from "@plasmicapp/host";
import { Input, InputNumber, Switch } from "antd";
import React from "react";

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
      <label>
        显示分页{" "}
        <Switch
          size="small"
          aria-label="显示分页"
          checked={value !== false}
          onChange={(enabled) => updateValue(enabled ? { ...options } : false)}
        />
      </label>
      {value !== false && (
        <>
          <label>
            每页条数{" "}
            <InputNumber
              aria-label="每页条数"
              size="small"
              min={1}
              precision={0}
              value={options.pageSize ?? options.defaultPageSize}
              placeholder="10"
              onChange={(next) =>
                update(
                  options.pageSize !== undefined
                    ? "pageSize"
                    : "defaultPageSize",
                  next,
                )
              }
            />
          </label>
          <label>
            可切换每页条数{" "}
            <Switch
              size="small"
              aria-label="可切换每页条数"
              checked={
                options.showSizeChanger ??
                (options.total ?? componentProps?.data?.data?.length ?? 0) > 50
              }
              onChange={(next) => update("showSizeChanger", next)}
            />
          </label>
          <label>
            快速跳页{" "}
            <Switch
              size="small"
              aria-label="快速跳页"
              checked={options.showQuickJumper ?? false}
              onChange={(next) => update("showQuickJumper", next)}
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
      <label>
        水平滚动宽度{" "}
        <Input
          size="small"
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
      <label>
        表体最大高度{" "}
        <InputNumber
          size="small"
          aria-label="表体最大高度"
          min={1}
          value={options.y}
          placeholder="随内容增长"
          onChange={(next) => update("y", next)}
        />
      </label>
    </div>
  );
}
