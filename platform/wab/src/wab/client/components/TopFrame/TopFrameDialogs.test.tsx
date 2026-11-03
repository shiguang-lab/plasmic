import type { TopFrameChromeProps } from "@/wab/client/components/TopFrame/TopFrameChrome";
import { TopFrameDialogs } from "@/wab/client/components/TopFrame/TopFrameDialogs";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import * as React from "react";

const deferred = vi.hoisted(() => ({
  loaded: vi.fn(),
  pending: Promise.withResolvers<void>(),
  mounted: vi.fn(),
}));
vi.mock("@/wab/client/components/TopFrame/TopFrameDialogsContent", async () => {
  deferred.loaded();
  await deferred.pending.promise;
  return {
    TopFrameDialogsContent: (props: TopFrameChromeProps) => {
      const [value, setValue] = React.useState("");
      React.useEffect(() => {
        deferred.mounted();
      }, []);
      return (
        <div data-testid="dialog-content">
          {props.showShareModal && (
            <input
              aria-label="share draft"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </div>
      );
    },
  };
});
afterEach(cleanup);
const props = { onboardingTour: {} } as TopFrameChromeProps;

test("defers closed dialogs, uses current props if dismissed during loading, and preserves state on reopen", async () => {
  const view = render(<TopFrameDialogs {...props} />);
  await act(() => Promise.resolve());
  expect(deferred.loaded).not.toHaveBeenCalled();
  view.rerender(<TopFrameDialogs {...props} showShareModal />);
  await vi.waitFor(() => expect(deferred.loaded).toHaveBeenCalledOnce());
  view.rerender(<TopFrameDialogs {...props} showShareModal={false} />);
  await act(async () => {
    deferred.pending.resolve();
    await deferred.pending.promise;
  });
  expect(await screen.findByTestId("dialog-content")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  view.rerender(<TopFrameDialogs {...props} showShareModal />);
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Retained form" },
  });
  view.rerender(<TopFrameDialogs {...props} showShareModal={false} />);
  view.rerender(<TopFrameDialogs {...props} showShareModal />);
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
    "Retained form",
  );
  expect(deferred.mounted).toHaveBeenCalledOnce();
});

test.each([
  "showProjectNameModal",
  "showCloneProjectModal",
  "showHostModal",
  "showUpsellForm",
  "showPublishModal",
  "keepPublishModalOpen",
  "mergeModalContext",
  "showShareModal",
  "dataSourcePicker",
  "showUiConfigModal",
  "showLocalizationModal",
  "showAppAuthModal",
  "onboardingTour",
])("starts the dialog group for %s", async (flag) => {
  render(
    <TopFrameDialogs
      {...props}
      {...{ [flag]: flag === "onboardingTour" ? { tour: "publish" } : true }}
    />,
  );
  expect(await screen.findByTestId("dialog-content")).toBeTruthy();
});
