const styles = {
  enterprise: {name: "企业工作台", description: "Dense, readable forms, lists and dashboards", tokens: {primary: "#1677ff", background: "#f5f7fa", surface: "#ffffff", text: "#1f2937", secondaryText: "#64748b", border: "#e5e7eb", radius: "8px", fontSize: "14px", fontFamily: "Inter, system-ui, sans-serif"}, layout: {pagePadding: "24px", sectionGap: "24px", controlGap: "8px", rowGap: "16px"}},
  editorial: {name: "内容与展示", description: "Generous typography and spacious content sections", tokens: {primary: "#7c3aed", background: "#faf9f6", surface: "#ffffff", text: "#202020", secondaryText: "#6b7280", border: "#e7e5e4", radius: "12px", fontSize: "16px", fontFamily: "Inter, system-ui, sans-serif"}, layout: {pagePadding: "32px", sectionGap: "40px", controlGap: "12px", rowGap: "24px"}},
  dark: {name: "深色控制台", description: "Dark operational dashboards with restrained accents", tokens: {primary: "#60a5fa", background: "#111827", surface: "#1f2937", text: "#f9fafb", secondaryText: "#9ca3af", border: "#374151", radius: "8px", fontSize: "14px", fontFamily: "Inter, system-ui, sans-serif"}, layout: {pagePadding: "24px", sectionGap: "24px", controlGap: "8px", rowGap: "16px"}},
};
function getStyle(id) {
  if (!id) return {styles: Object.entries(styles).map(([id, style]) => ({id, name: style.name, description: style.description}))};
  if (!styles[id]) throw new Error("Unknown style");
  return {id, ...styles[id], instructions: "Read existing project tokens first, then create named tokens and reference them in styles. This is a starting palette, not an automatic theme change. Read the registered Ant Design 6 ConfigProvider contract before setting its theme. Check color contrast and screenshots at desktop/mobile sizes."};
}
module.exports = {getStyle};
