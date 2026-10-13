import assert from "node:assert/strict";
import test from "node:test";
import { validateComponentReferences } from "./validate-plasmic-component-coverage.mjs";

const root = "references/libraries/antd_v6";
const registrations = [
  { library: "antd_v6", owner: "form", name: "plasmic-antd6-form", displayName: "Form" },
  { library: "antd_v6", owner: "form", name: "plasmic-antd6-form-item", displayName: "Form.Item" },
];
function fixture(items = registrations) {
  return [
    { path: `${root}/index.md`, content: `| [Form](components/form.md) | ${items.map((item) => `${item.displayName} (\`${item.name}\`)`).join("; ")} |` },
    { path: `${root}/components/form.md`, content: `# Form\n\n${items.map((item) => `| ${item.displayName} | \`${item.name}\` |`).join("\n")}\n\n## Usage\nReal fields.` },
  ];
}

test("main-component references include child registrations and final display names", () => {
  assert.deepEqual(validateComponentReferences(fixture(), registrations), { libraries: 1, registrations: 2 });
  assert.deepEqual(validateComponentReferences(fixture()), { libraries: 1, registrations: 2 });
});
test("source coverage rejects an omitted child or stale display name", () => {
  assert.throws(() => validateComponentReferences(fixture(registrations.slice(0, 1)), registrations), /Missing registered component/);
  const stale = registrations.map((item) => ({ ...item, displayName: item.name.endsWith("-item") ? "Form Field" : item.displayName }));
  assert.throws(() => validateComponentReferences(fixture(stale), registrations), /Stale registered display name/);
});
test("coverage rejects duplicate documents, wrong family and unknown registrations", () => {
  const files = fixture();
  assert.throws(() => validateComponentReferences([...files, { ...files[1], path: `${root}/components/form-item.md` }]), /Duplicate document ownership/);
  assert.throws(() => validateComponentReferences(files, registrations.map((item) => ({ ...item, owner: "form-item" }))), /Wrong main-component owner/);
  assert.throws(() => validateComponentReferences(files, registrations.slice(0, 1)), /Unknown documented registration/);
});
test("bundle coverage rejects index ownership, missing metadata and caption drift", () => {
  const files = fixture();
  assert.throws(() => validateComponentReferences([{ ...files[0], content: files[0].content.replace("Form.Item (", "Field (") }, files[1]]), /Index display name mismatch/);
  assert.throws(() => validateComponentReferences([files[0], { ...files[1], content: "# Form\n\n## Usage\nNo registration table." }]), /Missing registration metadata/);
  assert.throws(() => validateComponentReferences([{ ...files[0], content: files[0].content.replace("form.md", "missing.md") }, files[1]]), /Missing component document/);
});
