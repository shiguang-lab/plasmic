import { showBillingSuccess } from "@/wab/client/components/modals/PricingModal";
import { setLanguagePreference } from "@/wab/client/i18n";
import { assert } from "@/wab/shared/common";
import { cleanup, render, screen } from "@testing-library/react";
import { message } from "antd";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("shows a localized success message without opening a payment confirmation dialog", async () => {
  await setLanguagePreference("zh-CN");
  const success = vi.spyOn(message, "success").mockReturnValue(mock());
  showBillingSuccess();
  expect(success).toHaveBeenCalledOnce();
  const args = success.mock.calls[0][0];
  assert(args !== null && typeof args === "object" && "content" in args, "Expected a message configuration");
  render(<>{args.content}</>);
  expect(screen.getByText("账单已更新")).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  await setLanguagePreference("en");
});
