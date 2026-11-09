import { getComponentPresets } from "@/wab/client/code-components/code-presets";
import { elementSchemaToTplAndLogErrors } from "@/wab/client/code-components/code-components";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { CodeComponent } from "@/wab/shared/core/components";
import { ok } from "neverthrow";
import { createSite } from "@/wab/shared/core/sites";
import { ModelRevisions } from "@/wab/shared/model-revisions";

vi.mock("@/wab/client/code-components/code-components", () => ({ elementSchemaToTplAndLogErrors: vi.fn(() => ok({})) }));

it("isolates template conversion by editor and invalidates on registry or site replacement", () => {
  const component = { name: "Button" } as CodeComponent;
  let registry = "0:0";
  const makeStudio = () => ({ site: createSite(), modelRevisions: new ModelRevisions(),
    getCodeRegistrationRevision: () => registry,
    getCodeComponentMeta: () => ({ templates: { Primary: { props: {} } } }),
  } as unknown as StudioCtx);
  const first = makeStudio(), second = makeStudio();
  const before = getComponentPresets(first, component);
  expect(getComponentPresets(first, component)).toBe(before);
  expect(getComponentPresets(second, component)).not.toBe(before);
  expect(vi.mocked(elementSchemaToTplAndLogErrors).mock.calls.slice(-1)[0][0]).toBe(second.site);
  registry = "1:0";
  expect(getComponentPresets(first, component)).not.toBe(before);
  const replacement = createSite(), current = getComponentPresets(first, component);
  Object.defineProperty(first, "site", { value: replacement });
  expect(getComponentPresets(first, component)).not.toBe(current);
  expect(vi.mocked(elementSchemaToTplAndLogErrors).mock.calls.slice(-1)[0][0]).toBe(replacement);
});
