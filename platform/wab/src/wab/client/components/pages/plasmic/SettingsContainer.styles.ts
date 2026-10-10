import { createStyles } from "antd-style";

export const useSettingsStyles = createStyles(({ token }) => ({
  root: {
    width: "100%", maxWidth: 1040, padding: "32px 40px 48px", boxSizing: "border-box", userSelect: "text", color: token.colorText,
    "& h1": { fontSize: 28, lineHeight: 1.3, fontWeight: 600, margin: "0 0 8px" },
    "& h2": { fontSize: 16, lineHeight: 1.5, fontWeight: 600, margin: 0 },
    "& p": { color: token.colorTextSecondary, fontSize: 13, lineHeight: 1.6, margin: "6px 0 0" },
    "@media (max-width: 768px)": { padding: "24px 16px" },
  },
  header: { marginBottom: 28 },
  card: { border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadiusLG, padding: 24, marginBottom: 16, background: token.colorBgContainer },
  sectionHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 },
  account: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 20 },
  preference: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 20, "& label": { fontWeight: 500, fontSize: 14 } },
  profile: { display: "flex", alignItems: "center", gap: 16, minWidth: 0 },
  email: { color: token.colorTextSecondary, overflowWrap: "anywhere" },
  avatar: { background: token.colorPrimaryBg, color: token.colorPrimary, borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 600, "& img": { width: "100%", height: "100%", borderRadius: "inherit", objectFit: "cover" } },
  languageSelect: { width: 220, flexShrink: 0 },
  hint: { fontSize: 12, marginTop: 16 },
  error: { "&[role=alert]": { color: token.colorError } },
  empty: { background: token.colorFillQuaternary, borderRadius: token.borderRadius, color: token.colorTextSecondary, textAlign: "center", padding: "24px 16px", fontSize: 13 },
  list: { listStyle: "none", margin: 0, padding: 0, "& li": { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: `1px solid ${token.colorBorderSecondary}` }, "& li:last-child": { borderBottom: 0 } },
  token: { overflowWrap: "anywhere", minWidth: 0, fontSize: 12 },
  host: { overflowWrap: "anywhere", minWidth: 0 },
  actions: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  responsive: { "@media (max-width: 768px)": { "& section": { padding: 20 }, "& [data-settings-row]": { flexDirection: "column", alignItems: "stretch" }, "& .ant-select": { width: "100%" }, "& li": { flexWrap: "wrap" } } },
}));
