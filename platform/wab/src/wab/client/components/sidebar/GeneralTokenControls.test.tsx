import GeneralDataTokenControl from "@/wab/client/components/sidebar/GeneralDataTokenControl";
import GeneralTokenControl from "@/wab/client/components/sidebar/GeneralTokenControl";
import MultiAssetsActions, { useMultiAssetsActions } from "@/wab/client/components/sidebar/MultiAssetsActions";
import { Matcher } from "@/wab/client/components/view-common";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkDataToken } from "@/wab/commons/DataToken";
import { derefToken, mkStyleToken } from "@/wab/commons/StyleToken";
import { toOpaque } from "@/wab/commons/types";
import type { DataTokenValue } from "@/wab/commons/DataToken";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { ImmutableToken, MutableToken, OverrideableToken } from "@/wab/shared/core/tokens";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const rowRender = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicGeneralTokenControl", () => ({
  default: ({ children, value, rowItem }: React.PropsWithChildren<{ value: React.ReactNode; rowItem: { icon?: React.ReactNode; onClick?: () => void } }>) => {
    rowRender();
    return <div data-testid={`row-${String(children)}`}><button onClick={rowItem.onClick}>{children}</button><output>{value}</output>{rowItem.icon}</div>;
  },
}));
vi.mock("@/wab/client/components/style-controls/TokenDefinedIndicator", () => ({ TokenDefinedIndicator: () => <span>Token indicator</span> }));

afterEach(() => { cleanup(); rowRender.mockClear(); });

function fixture(imported: boolean) {
  const site = createSite();
  const style = mkStyleToken({ name: "Folder/Style", type: "Color", value: "#123456" });
  const data = mkDataToken({ name: "Folder/Data", value: '"Before"' });
  const other = mkDataToken({ name: "Other", value: "42" });
  site.styleTokens.push(style);
  site.dataTokens.push(data, other);
  const models = new ModelSnapshots();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = mock<StudioCtx>();
  Object.defineProperty(studio, "modelSnapshots", { value: models });
  const styleToken = imported ? new OverrideableToken(style, site) : new MutableToken(style);
  const dataToken = imported ? new ImmutableToken(data, false) : new MutableToken(data);
  const commit = (fn: () => void) => act(() => { models.sync(recorder.withRecording(fn).changes); });
  return { site, style, data, other, models, studio, styleToken, dataToken, commit, dispose: () => { recorder.dispose(); models.dispose(); } };
}

function Select({ id }: { id: string }) {
  const selection = useMultiAssetsActions();
  return <button onClick={() => selection.onAssetSelected(id, true)}>Select token</button>;
}

it.each([false, true])("reads actual base name/identity fields for local and imported token wrappers (imported=%s)", (imported) => {
  const f = fixture(imported);
  const clicked = vi.fn();
  const matcher = new Matcher("");
  const menu = () => <div>Menu</div>;
  const styleId = f.style.uuid;
  const styleValue = derefToken([], f.styleToken);
  const beforeDataValue = toOpaque<string, "DataTokenValue">('"Before"');
  const afterDataValue = toOpaque<string, "DataTokenValue">('"After"');
  let currentStyleToken = f.styleToken;
  function Controls({ dataValue, styleToken = f.styleToken }: { dataValue: DataTokenValue; styleToken?: typeof f.styleToken }) {
    return <StudioCtxContext.Provider value={f.studio}><MultiAssetsActions type="token" selectableAssets={[styleId]} onDelete={async () => false}>
      <Select id={styleId} />
      <GeneralTokenControl token={styleToken} tokenValue={styleValue} matcher={matcher} menu={menu} onClick={clicked} />
      <GeneralDataTokenControl token={f.dataToken} tokenValue={dataValue} matcher={matcher} menu={menu} onClick={clicked} />
    </MultiAssetsActions></StudioCtxContext.Provider>;
  }
  const view = render(<Controls dataValue={beforeDataValue} />);
  try {
    expect(within(screen.getByTestId("row-Style")).getByText("#123456")).toBeTruthy();
    expect(within(screen.getByTestId("row-Data")).getByText("Before")).toBeTruthy();
    const renders = rowRender.mock.calls.length;
    f.commit(() => { f.other.name = "Unrelated"; f.style.value = "#abcdef"; });
    expect(rowRender).toHaveBeenCalledTimes(renders);
    f.commit(() => { f.style.name = "Folder/New style"; f.data.name = "Other/New data"; });
    expect(screen.getByTestId("row-New style")).toBeTruthy();
    expect(screen.getByTestId("row-New data")).toBeTruthy();
    fireEvent.click(screen.getByText("Select token"));
    const styleRow = screen.getByTestId("row-New style");
    if (imported) {
      expect(within(styleRow).queryByRole("checkbox")).toBeNull();
    } else {
      expect(within(styleRow).getByRole("checkbox")).toHaveProperty("checked", true);
      const replacement = mkStyleToken({ name: "Folder/New style", type: "Color", value: "#123456" });
      f.commit(() => { f.site.styleTokens.splice(f.site.styleTokens.indexOf(f.style), 1, replacement); });
      currentStyleToken = new MutableToken(replacement);
      view.rerender(<Controls dataValue={beforeDataValue} styleToken={currentStyleToken} />);
      expect(within(styleRow).getByRole("checkbox")).toHaveProperty("checked", false);
    }
    view.rerender(<Controls dataValue={afterDataValue} styleToken={currentStyleToken} />);
    expect(within(screen.getByTestId("row-New data")).getByText("After")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New data" }));
    expect(clicked).toHaveBeenCalledOnce();
  } finally { view.unmount(); f.dispose(); }
});
