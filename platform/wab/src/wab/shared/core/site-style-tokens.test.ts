import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { componentToUsedTokens } from "@/wab/shared/core/site-style-tokens";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";

it.each(["self-reference", "two-token cycle"])(
  "collects used tokens once when the alias chain ends in a %s",
  (cycle) => {
    const site = createSite();
    const first = mkStyleToken({ name: "First", type: "Color", value: "#fff" });
    const second = mkStyleToken({ name: "Second", type: "Color", value: mkTokenRef(first) });
    first.value = mkTokenRef(cycle === "self-reference" ? first : second);
    const entry = mkStyleToken({ name: "Entry", type: "Color", value: mkTokenRef(first) });
    site.styleTokens.push(entry, first, second);
    const component = mkComponent({
      name: "Example",
      type: ComponentType.Plain,
      tplTree: (baseVariant) =>
        mkTplTagX("div", { baseVariant, styles: { color: mkTokenRef(entry) } }),
    });
    site.components.push(component);

    expect(componentToUsedTokens(site, component)).toEqual(
      cycle === "self-reference" ? [entry, first] : [entry, first, second],
    );
  },
);
