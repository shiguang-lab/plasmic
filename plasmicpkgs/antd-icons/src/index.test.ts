import * as Icons from "@ant-design/icons";
import assert from "node:assert/strict";
import { test } from "node:test";
import { registerAll } from "./index";

test("the installable library registers official icon components with native card previews", () => {
  const names = new Set<string>();
  const sections = new Set<string>();
  registerAll({
    registerComponent(component, meta) {
      const name = meta.importName as keyof typeof Icons;
      assert.equal(component, Icons[name]);
      assert.equal(meta.name, `plasmic-antd-icon-${name}`);
      assert.equal(meta.displayName, name);
      assert.equal(meta.importPath, "@ant-design/icons");
      assert.equal(meta.props.name, undefined);
      assert.equal(Boolean(meta.props.twoToneColor), name.endsWith("TwoTone"));
      assert.match(meta.thumbnailUrl ?? "", /^data:image\/svg\+xml,/);
      assert(!names.has(name), `Duplicate icon ${name}`);
      names.add(name);
      sections.add(meta.section ?? "");
    },
  });
  assert.equal(names.size, 848);
  assert.deepEqual(sections, new Set(["Outlined", "Filled", "Two Tone"]));
  assert(names.has("PlusOutlined"), "PlusOutlined is registered independently");
  assert(!names.has("createFromIconfontCN"), "Icon helpers are excluded");
});
