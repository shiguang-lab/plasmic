import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { TokenEditModal } from "@/wab/client/components/sidebar/TokenEditModal";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import {
  MutableToken,
  OverrideableToken,
  toFinalToken,
} from "@/wab/shared/core/tokens";
import { createSite, writeable } from "@/wab/shared/core/sites";
import { StyleToken } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { ok } from "neverthrow";
import React from "react";

const editorCalls = vi.hoisted(() => ({
  color: [] as Array<Record<string, any>>,
  font: [] as Array<Record<string, any>>,
  general: [] as Array<Record<string, any>>,
}));

vi.mock("@/wab/client/components/sidebar/ColorTokenPopup", async () => {
  const ReactModule = await import("react");
  return {
    ColorTokenPopup: (props: Record<string, any>) => {
      editorCalls.color.push(props);
      return ReactModule.createElement("div", { "data-testid": "color-editor" });
    },
  };
});

vi.mock(
  "@/wab/client/components/sidebar/FontFamilyTokenEditModal",
  async () => {
    const ReactModule = await import("react");
    return {
      FontFamilyTokenEditModal: (props: Record<string, any>) => {
        editorCalls.font.push(props);
        return ReactModule.createElement("div", { "data-testid": "font-editor" });
      },
    };
  },
);

vi.mock("@/wab/client/components/sidebar/GeneralTokenEditModal", async () => {
  const ReactModule = await import("react");
  return {
    GeneralTokenEditModal: (props: Record<string, any>) => {
      editorCalls.general.push(props);
      return ReactModule.createElement("div", { "data-testid": "general-editor" });
    },
  };
});

beforeEach(() => {
  editorCalls.color.length = 0;
  editorCalls.font.length = 0;
  editorCalls.general.length = 0;
});

afterEach(cleanup);

function setup(registered: boolean) {
  const site = createSite();
  const base = new StyleToken({
    name: "Brand",
    type: "Color",
    value: "Arial",
    variantedValues: [],
    uuid: registered ? "registered-token" : "local-token",
    isRegistered: registered,
    regKey: registered ? "brand-token" : null,
  });
  site.styleTokens.push(base);
  const { studioCtx } = fakeStudioCtx({ site });
  const token = toFinalToken(base, site);
  if (!(token instanceof MutableToken || token instanceof OverrideableToken)) {
    throw new Error("Expected a mutable or overrideable token");
  }
  return { site, base, studioCtx, token };
}

it.each([
  ["mutable", false],
  ["overrideable", true],
] as const)(
  "branches on the %s token's base type and keeps the opaque command handle",
  async (_kind, registered) => {
    const { site, base, studioCtx, token } = setup(registered);
    const onClose = vi.fn();
    const vsh = new VariantedStylesHelper(site);
    const autoFocusName = !registered;
    try {
      render(
        <TokenEditModal
          studioCtx={studioCtx}
          token={token}
          onClose={onClose}
          autoFocusName={autoFocusName}
          vsh={vsh}
        />,
      );

      await waitFor(() =>
        expect(screen.getByTestId("color-editor")).toBeTruthy(),
      );
      const color = editorCalls.color.at(-1);
      expect(color?.token).toBe(token);
      expect(color?.studioCtx).toBe(studioCtx);
      expect(color?.onClose).toBe(onClose);
      expect(color?.autoFocusName).toBe(autoFocusName);
      expect(color?.vsh).toBe(vsh);

      await act(async () => {
        await studioCtx.change(() => {
          writeable(base).type = "FontFamily";
          return ok();
        });
      });
      await waitFor(() =>
        expect(screen.getByTestId("font-editor")).toBeTruthy(),
      );
      expect(screen.queryByTestId("color-editor")).toBeNull();
      const font = editorCalls.font.at(-1);
      expect(font?.token).toBe(token);
      expect(font?.studioCtx).toBe(studioCtx);
      expect(font?.onClose).toBe(onClose);
      expect(font?.defaultEditingName).toBe(autoFocusName);
      expect(font?.vsh).toBe(vsh);

      await act(async () => {
        await studioCtx.change(() => {
          writeable(base).type = "Spacing";
          return ok();
        });
      });
      await waitFor(() =>
        expect(screen.getByTestId("general-editor")).toBeTruthy(),
      );
      expect(screen.queryByTestId("font-editor")).toBeNull();
      const general = editorCalls.general.at(-1);
      expect(general?.token).toBe(token);
      expect(general?.studioCtx).toBe(studioCtx);
      expect(general?.onClose).toBe(onClose);
      expect(general?.defaultEditingName).toBe(autoFocusName);
      expect(general?.vsh).toBe(vsh);
      expect(token.type).toBe("Spacing");
    } finally {
      studioCtx.dispose();
    }
  },
);
