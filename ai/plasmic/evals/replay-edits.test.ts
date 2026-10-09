import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COPILOT_TOOLS } from "@/wab/client/copilot";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { flattenTpls } from "@/wab/shared/core/tpls";
import fs from "node:fs";

type Replay = {
  id: string;
  componentUuid: string;
  elementUuid: string;
  operations: { name: string; input: Record<string, unknown> }[];
};
const replays: Replay[] = JSON.parse(
  fs.readFileSync(
    ensure(process.env.PLASMIC_SKILL_EVAL_REPLAY, "Replay file is required"),
    "utf8",
  ),
);
for (const replay of replays) {
  it(`replays ${replay.id} through real editor tools and preserves unaffected nodes`, async () => {
    const site = createSite();
    const { studioCtx } = fakeStudioCtx({ site });
    const call = async (name: string, input: Record<string, unknown> = {}) =>
      JSON.parse(
        await ensure(COPILOT_TOOLS[name], "Missing tool").execute(
          studioCtx,
          input,
        ),
      );
    try {
      const created = await call("createComponent", {
        name: "AccountSettings",
        type: "page",
        path: "/accountsettings",
      });
      const componentUuid = created.results[0].uuid;
      await call("insertHtml", {
        componentUuid,
        html: '<div data-plasmic-name="EditCard" style="padding:16px"><div data-plasmic-name="EmailInput">Email field</div></div><div data-plasmic-name="SummaryCard" style="padding:12px">Keep this</div>',
      });
      const page = ensure(
        site.components.find((c) => c.uuid === componentUuid),
        "page",
      );
      const nodes = flattenTpls(page.tplTree);
      const card = ensure(
        nodes.find((node) => node.name === "EditCard"),
        "card",
      );
      const others = () =>
        flattenTpls(page.tplTree)
          .filter((node) => node !== card)
          .map((node) => ({
            uuid: node.uuid,
            name: node.name,
            values: node.vsettings.map((setting) => ({ ...setting.rs.values })),
          }));
      const before = others();
      expect(replay.operations.length).toBeGreaterThan(0);
      for (const operation of replay.operations) {
        expect(operation.name).toBe("changeElement");
        expect(operation.input.componentUuid).toBe(replay.componentUuid);
        expect(operation.input.elementUuid).toBe(replay.elementUuid);
        expect(Object.keys(operation.input).sort()).toEqual([
          "componentUuid",
          "elementUuid",
          "styles",
        ]);
        await call(operation.name, {
          ...operation.input,
          componentUuid,
          elementUuid: card.uuid,
        });
      }
      for (const side of ["top", "right", "bottom", "left"]) {
        expect(card.vsettings[0].rs.values[`padding-${side}`]).toBe("24px");
      }
      expect(others()).toEqual(before);
      expect((await call("validate")).errors).toEqual([]);
      await call("read", { componentUuids: [componentUuid] });
    } finally {
      studioCtx.copilotActivity.dispose();
    }
  });
}
