import { staticPreviewPageLinks } from "@/wab/client/components/live/preview-page-links";
import { ComponentType, mkComponent, mkPageMeta } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { CustomCode, PageHref } from "@/wab/shared/model/classes";

it("finds authored menu links and page references without evaluating business code", () => {
  const page = (path: string) => mkComponent({ type: ComponentType.Page, pageMeta: mkPageMeta({ path }), tplTree: baseVariant => mkTplTagX("a", { baseVariant, styles: {} }) });
  const current = page("/home"), target = page("/users"), direct = page("/settings");
  const site = createSite({ components: [current, target, direct] });
  const attrs = current.tplTree.vsettings[0].attrs;
  attrs.menuItems = new CustomCode({ code: JSON.stringify([{ children: [{ href: "/users?tab=all#details" }, { href: "/users" }, { href: "https://external.invalid/settings" }, { href: "//external.invalid/users" }, { href: "/home" }] }]), fallback: null });
  attrs.destination = new PageHref({ page: direct, params: {}, query: {}, fragment: null, encode: true });
  attrs.onClick = new CustomCode({ code: '(() => { throw new Error("must not execute"); })()', fallback: null });
  expect(staticPreviewPageLinks(site, current)).toEqual([target, direct]);
  expect(attrs.menuItems.code).toContain("/users?tab=all#details");
});
