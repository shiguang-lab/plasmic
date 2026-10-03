import assert from "node:assert/strict";
import test from "node:test";
import { registerAll } from "./index";

// These parameters are already published in the NAS library. Removing them
// makes the native hostless publisher reject the entire library refresh.
test("registrations retain the published NAS component contracts", () => {
  const registrations = new Map<string, any>();
  registerAll({ registerComponent(_component, meta) { registrations.set(meta.name, meta); }, registerGlobalContext() {}, registerToken() {} });
  const published = {
    "date-picker": ["multiple", "value", "disabled", "onChange", "picker"],
    collapse: ["accordion", "items", "activeKey", "children", "expandIconPlacement", "destroyOnHidden", "onChange"],
    slider: ["range", "value", "marks", "tooltip", "keyboard", "onChangeComplete"],
    segmented: ["options", "value", "vertical", "name", "onChange"],
    "app-shell": ["productName", "userName", "languages", "appSources", "menuItems", "children"],
  };
  for (const [component, props] of Object.entries(published)) {
    const meta = registrations.get(`plasmic-antd6-${component}`);
    assert(meta, component);
    for (const prop of props) assert(meta.props[prop], `${component}.${prop} must remain publishable`);
  }
});
