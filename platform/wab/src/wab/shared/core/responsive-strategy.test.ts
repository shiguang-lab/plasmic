import { getResponsiveStrategy, getResponsiveStrategyFromMediaQueries, createSite } from "@/wab/shared/core/sites";
import { mkVariant } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ResponsiveStrategy } from "@/wab/shared/responsiveness";

it.each([
  { queries: [], expected: ResponsiveStrategy.unknown },
  { queries: [null, undefined, ""], expected: ResponsiveStrategy.desktopFirst },
  { queries: ["(min-width: 0px)"], expected: ResponsiveStrategy.desktopFirst },
  { queries: ["(min-width: 768px)", "(min-width: 1024px)"], expected: ResponsiveStrategy.mobileFirst },
  { queries: ["(max-width: 1024px)"], expected: ResponsiveStrategy.desktopFirst },
  { queries: ["(min-width: 768px) and (max-width: 1024px)"], expected: ResponsiveStrategy.desktopFirst },
])("keeps the strategy's existing truthy width semantics for $queries", ({ queries, expected }) => {
  expect(getResponsiveStrategyFromMediaQueries(queries)).toBe(expected);
});

it("uses the same strategy algorithm for the model command API", () => {
  const site = createSite();
  const group = ensure(site.activeScreenVariantGroup, "Expected initial screen group");
  expect(getResponsiveStrategy(site)).toBe(ResponsiveStrategy.unknown);
  group.variants.push(mkVariant({ name: "Mobile", parent: group, mediaQuery: "(min-width: 768px)" }));
  expect(getResponsiveStrategy(site)).toBe(ResponsiveStrategy.mobileFirst);
  group.variants.push(mkVariant({ name: "Desktop", parent: group, mediaQuery: "(max-width: 1280px)" }));
  expect(getResponsiveStrategy(site)).toBe(ResponsiveStrategy.desktopFirst);
});
