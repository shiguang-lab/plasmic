import { AntdConfigProvider } from "@/wab/client/antd-theme";
import { EnableLocalizationModal } from "@/wab/client/components/modals/EnableLocalizationModal";
import { toOpaque } from "@/wab/commons/types";
import { ApiProject } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ConfigProvider } from "antd";
import React from "react";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({
  updateLocalizationProjectFlags: vi.fn(),
}));

vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useAppCtx: () => ({ api: {}, teams: [] }),
}));
vi.mock("@/wab/client/frame-ctx/top-frame-ctx", () => ({
  useTopFrameCtx: () => ({
    hostFrameApi: {
      updateLocalizationProjectFlags: mocks.updateLocalizationProjectFlags,
    },
  }),
}));

const project = mock<ApiProject>({
  id: toOpaque("project-id"),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateLocalizationProjectFlags.mockResolvedValue(undefined);
});
afterEach(cleanup);

it("disables localization through the project flags command", async () => {
  const onDone = vi.fn();
  render(
    <AntdConfigProvider>
      <ConfigProvider theme={{ token: { motion: false } }}>
        <EnableLocalizationModal
          isLocalizationEnabled
          project={project}
          onDone={onDone}
        />
      </ConfigProvider>
    </AntdConfigProvider>,
  );
  expect(
    screen.getByRole("dialog", {
      name: "Disable localization for this project?",
    }),
  ).toBeInTheDocument();

  fireEvent.submit(
    ensure(document.querySelector("form"), "Expected localization form"),
  );

  await waitFor(() =>
    expect(
      mocks.updateLocalizationProjectFlags,
    ).toHaveBeenCalledExactlyOnceWith(false, undefined, undefined),
  );
  expect(onDone).toHaveBeenCalledOnce();
});
