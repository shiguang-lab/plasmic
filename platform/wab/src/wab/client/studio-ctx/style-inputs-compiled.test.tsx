import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { SingleRsStyleInputs, type NativeStyleProvider } from "@/wab/client/studio-ctx/style-inputs";
import { useStyleCell, useStyleIndicator } from "@/wab/client/studio-ctx/style-inputs-react";
import { mkRuleSet } from "@/wab/shared/core/styles";
import { act, render, screen } from "@testing-library/react";
import * as React from "react";

function StyleProbe({ provider }: { provider: NativeStyleProvider }) {
  const cell = useStyleCell(provider, "opacity");
  const indicator = useStyleIndicator(provider, "opacity");
  return <output>{cell?.value}:{indicator.source}</output>;
}

function fixture() {
  const models = new ModelSnapshots();
  const owner = new SingleRsStyleInputs(() => models);
  const rs = mkRuleSet({ values: { opacity: "0.2" } });
  const provider: NativeStyleProvider = {
    getNativeStyleSource: () => ({
      kind: "singleRs", inputs: owner,
      source: { kind: "singleRs", read: { kind: "ruleSet", rs, forTag: "div" } },
    }),
  };
  return { models, owner, rs, provider };
}

it("updates compiled finite CSS readers and retains their last snapshot after disposal", () => {
  const { models, owner, rs, provider } = fixture();
  const contents = () => <React.StrictMode><StyleProbe provider={provider} /></React.StrictMode>;
  const mounted = render(contents());
  try {
    expect(screen.getByRole("status").textContent).toBe("0.2:setNonVariable");
    act(() => {
      const previous = rs.values;
      rs.values = { ...previous, opacity: "0.8" };
      models.sync([{ type: "update", oldValue: previous, newValue: rs.values, changeNode: { inst: rs, field: "values" } }], () => owner.prepareCommit());
      owner.publishCommit();
    });
    expect(screen.getByRole("status").textContent).toBe("0.8:setNonVariable");
    owner.dispose();
    const declare = vi.spyOn(models, "declaredField");
    mounted.rerender(contents());
    expect(screen.getByRole("status").textContent).toBe("0.8:setNonVariable");
    expect(declare).not.toHaveBeenCalled();
  } finally { mounted.unmount(); owner.dispose(); models.dispose(); }
});

it("does not retain suspended CSS candidates", () => {
  const { models, owner, provider } = fixture();
  const pending = new Promise<void>(() => undefined);
  function Suspended(): React.ReactNode { useStyleCell(provider, "opacity"); throw pending; }
  const mounted = render(<React.Suspense fallback="Pending"><Suspended /></React.Suspense>);
  try {
    expect(owner["entries"].size).toBe(0);
  } finally { mounted.unmount(); owner.dispose(); models.dispose(); }
});
