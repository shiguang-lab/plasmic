import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import SliceControls from "@/wab/client/components/splits/SliceControls";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { SplitStatus, SplitType } from "@/wab/shared/core/splits";
import { createSite } from "@/wab/shared/core/sites";
import { TplMgr } from "@/wab/shared/TplMgr";
import { Split } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import dayjs from "dayjs";
import React from "react";

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  const { default: dayjsForMock } = await import("dayjs");
  return {
    ...actual,
    Slider: ({
      value,
      onChange,
    }: {
      value: number;
      onChange: (value: number) => void;
    }) => (
      <input
        aria-label="Slice value"
        type="range"
        min={1}
        max={99}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    ),
    DatePicker: ({
      value,
      onChange,
    }: {
      value?: import("dayjs").Dayjs;
      onChange: (value: import("dayjs").Dayjs | null) => void;
    }) => (
      <input
        aria-label="Schedule date"
        value={value ? value.format("YYYY-MM-DDTHH:mm") : ""}
        onChange={(event) =>
          onChange(
            event.target.value ? dayjsForMock(event.target.value) : null,
          )
        }
      />
    ),
  };
});

afterEach(cleanup);

async function setup(splitType: SplitType) {
  const site = createSite();
  const split = new Split({
    uuid: "slice-controls-split",
    name: "Slice controls split",
    splitType,
    slices: [],
    status: SplitStatus.New,
    targetEvents: [],
    description: null,
    externalId: null,
  });
  site.splits.push(split);
  const component = new TplMgr({ site }).addComponent({
    name: "Page",
    type: ComponentType.Plain,
  });
  const { studioCtx } = fakeStudioCtx({ site });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  return { component, split, studioCtx };
}

let parentRenders = 0;

function Parent(props: {
  split: Split;
  idx: number;
  values: any[];
  onChange: (vals: any[]) => void;
}) {
  parentRenders += 1;
  return <SliceControls {...props} />;
}

it("switches the rendered control when splitType is committed without rendering the parent", async () => {
  const { split, studioCtx } = await setup(SplitType.Experiment);
  const values = [40, 60];
  const onChange = vi.fn<(vals: any[]) => void>();
  parentRenders = 0;
  try {
    const view = render(
      <StudioCtxContext.Provider value={studioCtx}>
        <Parent split={split} idx={1} values={values} onChange={onChange} />
      </StudioCtxContext.Provider>,
    );
    expect(parentRenders).toBe(1);
    expect(screen.getByRole("slider").getAttribute("min")).toBe("1");
    expect(screen.getByRole("slider").getAttribute("max")).toBe("99");
    expect(screen.getByRole("slider").getAttribute("value")).toBe("60");

    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        split.splitType = SplitType.Schedule;
      });
    });
    await waitFor(() => expect(screen.getByText("Start date")).toBeTruthy());
    expect(screen.getByText("End date")).toBeTruthy();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(parentRenders).toBe(1);

    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        split.splitType = SplitType.Segment;
      });
    });
    await waitFor(() => expect(screen.getByText("Targeting")).toBeTruthy());
    expect(screen.getByText("Edit Rules")).toBeTruthy();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(parentRenders).toBe(1);

    view.unmount();
  } finally {
    studioCtx.dispose();
  }
});

it("emits complementary percentages from the slider without mutating the input values", async () => {
  const { split, studioCtx } = await setup(SplitType.Experiment);
  const values = [40, 60];
  const onChange = vi.fn<(vals: any[]) => void>();
  try {
    const view = render(
      <StudioCtxContext.Provider value={studioCtx}>
        <Parent split={split} idx={0} values={values} onChange={onChange} />
      </StudioCtxContext.Provider>,
    );
    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("value")).toBe("40");

    fireEvent.change(slider, { target: { value: "70" } });

    expect(onChange).toHaveBeenLastCalledWith([70, 30]);
    expect(values).toEqual([40, 60]);
    expect(slider.getAttribute("value")).toBe("40");

    view.unmount();
  } finally {
    studioCtx.dispose();
  }
});

it("keeps the schedule and segment paths working while idx0 stays hidden", async () => {
  const { split, studioCtx } = await setup(SplitType.Schedule);
  const from = "2024-01-01T00:00:00.000Z";
  const to = "2024-01-02T00:00:00.000Z";
  const values = [
    "{}",
    JSON.stringify({ "<=": [from, { var: "time" }, to] }),
  ];
  const onChange = vi.fn<(vals: any[]) => void>();
  try {
    const scheduleView = render(
      <StudioCtxContext.Provider value={studioCtx}>
        <Parent split={split} idx={1} values={values} onChange={onChange} />
      </StudioCtxContext.Provider>,
    );
    expect(screen.getByText("Start date")).toBeTruthy();
    expect(screen.getByText("End date")).toBeTruthy();
    const dateInputs = screen.getAllByLabelText("Schedule date");
    const fromInput = ensure(dateInputs[0], "Expected from date input");
    const toInput = ensure(dateInputs[1], "Expected to date input");
    expect(fromInput.getAttribute("value")).toBe(
      dayjs(dayjs(from).format("YYYY-MM-DDTHH:mm")).format(
        "YYYY-MM-DDTHH:mm",
      ),
    );
    expect(toInput.getAttribute("value")).toBe(
      dayjs(dayjs(to).format("YYYY-MM-DDTHH:mm")).format("YYYY-MM-DDTHH:mm"),
    );

    fireEvent.change(fromInput, { target: { value: "2024-02-03T04:05" } });
    const newFrom = dayjs("2024-02-03T04:05").toISOString();
    expect(onChange).toHaveBeenLastCalledWith([
      values[0],
      JSON.stringify({ "<=": [newFrom, { var: "time" }, to] }),
    ]);
    expect(values[1]).toBe(
      JSON.stringify({ "<=": [from, { var: "time" }, to] }),
    );
    scheduleView.unmount();

    const hiddenSchedule = render(
      <StudioCtxContext.Provider value={studioCtx}>
        <Parent split={split} idx={0} values={values} onChange={onChange} />
      </StudioCtxContext.Provider>,
    );
    expect(hiddenSchedule.container.childElementCount).toBe(0);
    hiddenSchedule.unmount();

    await act(async () => {
      await studioCtx.changeUnsafe(() => {
        split.splitType = SplitType.Segment;
      });
    });
    const segmentValues = ["{}", "{}"];
    const segmentView = render(
      <StudioCtxContext.Provider value={studioCtx}>
        <Parent
          split={split}
          idx={1}
          values={segmentValues}
          onChange={onChange}
        />
      </StudioCtxContext.Provider>,
    );
    expect(screen.getByText("Targeting")).toBeTruthy();
    expect(screen.getByText("Edit Rules")).toBeTruthy();
    expect(screen.getByText("No rules set.")).toBeTruthy();
    segmentView.unmount();

    const hiddenSegment = render(
      <StudioCtxContext.Provider value={studioCtx}>
        <Parent
          split={split}
          idx={0}
          values={segmentValues}
          onChange={onChange}
        />
      </StudioCtxContext.Provider>,
    );
    expect(hiddenSegment.container.childElementCount).toBe(0);
    hiddenSegment.unmount();
  } finally {
    studioCtx.dispose();
  }
});
