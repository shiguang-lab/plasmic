import React from "react";
import { Select, theme } from "antd";

export interface AppSourceOption { value: string; label: string; }

// Visual contract from fintechgrowthui's @react/ui AppSource; data stays host-owned.
export function AppSourceSelect({ options, value, language, onChange }: {
  options: AppSourceOption[];
  value?: string;
  language: string;
  onChange: (value: string) => void;
}) {
  const { token } = theme.useToken();
  const chinese = language.replace(/_/g, "-").toLowerCase().startsWith("zh");
  const title = chinese ? "运营 App" : "Operations App";
  const current = chinese ? "当前" : "Current";
  const hint = chinese ? "切换 App 以查看对应数据" : "Switch apps to view their data";
  const label = (text: string, active: boolean) => <span style={{ display: "inline-flex", gap: 10, alignItems: "center", minWidth: 0 }}>
    <i aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: active ? token.colorPrimary : token.colorTextQuaternary }} />
    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
  </span>;
  const hintStyle: React.CSSProperties = { padding: "8px 12px", color: token.colorTextTertiary, fontSize: 12 };
  return <Select aria-label={title} value={value} style={{ minWidth: 180, width: 180 }}
    popupMatchSelectWidth={320}
    options={options.map(item => ({ value: item.value, label: label(item.label, true), text: item.label }))}
    onChange={next => { if (next !== value) onChange(next); }}
    optionRender={option => <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "8px 4px" }}>
      {label(option.data.text, option.value === value)}
      {option.value === value && <span style={{ color: token.colorPrimary, fontSize: 12, flexShrink: 0 }}>{current}</span>}
    </div>}
    popupRender={menu => <><div style={hintStyle}>{title}</div>{menu}<div style={hintStyle}>{hint}</div></>}
  />;
}
