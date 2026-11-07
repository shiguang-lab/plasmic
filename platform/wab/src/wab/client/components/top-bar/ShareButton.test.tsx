import ShareButton from "@/wab/client/components/top-bar/ShareButton";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";

const mocks = vi.hoisted(() => ({
  setShowShareModal: vi.fn(),
}));

vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({
    topFrameApi: { setShowShareModal: mocks.setShowShareModal },
  }),
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
}));
vi.mock(
  "@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicShareButton",
  () => ({
    PlasmicShareButton: (props: {
      onClick: () => void;
      share?: { "aria-label"?: string };
      tooltip?: string;
    }) => (
      <button type="button" onClick={props.onClick} {...props.share}>
        {props.tooltip}
      </button>
    ),
  }),
);
afterEach(cleanup);

test("opens the share dialog through the top-frame API on click", () => {
  render(<ShareButton />);
  const button = screen.getByRole("button", { name: "Share project" });
  expect(mocks.setShowShareModal).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(mocks.setShowShareModal).toHaveBeenCalledExactlyOnceWith(true);
});
