import { ccClientCallbackFns } from "@/wab/client/code-components/code-components";
import { message, notification } from "antd";

afterEach(() => vi.restoreAllMocks());

it("keeps cleanup diagnostics out of user-facing messages and notifications", () => {
  const toast = vi.spyOn(message, "warning");
  const warning = vi.spyOn(notification, "warning");
  const error = vi.spyOn(notification, "error");
  const diagnostic = vi
    .spyOn(console, "warn")
    .mockImplementation(() => undefined);
  const warnings = [
    {
      message: "Ignored unsupported style object-fit",
      description: "Unknown prop extra was discarded",
    },
  ];

  ccClientCallbackFns.onSchemaToTplWarnings(warnings);
  ccClientCallbackFns.onElementStyleWarnings?.(warnings);

  expect(toast).not.toHaveBeenCalled();
  expect(warning).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  expect(diagnostic).toHaveBeenCalledTimes(2);
  expect(diagnostic).toHaveBeenCalledWith(
    "[code-components]",
    warnings[0].message,
    warnings[0].description,
  );
});
