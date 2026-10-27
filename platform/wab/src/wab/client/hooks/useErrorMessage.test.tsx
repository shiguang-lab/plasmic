import { showError } from "@/wab/client/ErrorNotifications";
import { useErrorMessage } from "@/wab/client/hooks/useErrorMessage";
import { renderHook } from "@testing-library/react";

vi.mock("@/wab/client/ErrorNotifications", () => ({ showError: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it("reports a request failure without repeating it on ordinary renders", () => {
  const failure = new Error("Offline");
  const { rerender } = renderHook(({ error }) => useErrorMessage(error, "Failed to load projects"), {
    initialProps: { error: undefined as Error | undefined },
  });
  expect(showError).not.toHaveBeenCalled();
  rerender({ error: failure });
  rerender({ error: failure });
  expect(showError).toHaveBeenCalledExactlyOnceWith(failure, { title: "Failed to load projects" });
  rerender({ error: undefined });
  const retryError = new Error("Unavailable");
  rerender({ error: retryError });
  expect(showError).toHaveBeenCalledTimes(2);
  expect(showError).toHaveBeenLastCalledWith(retryError, { title: "Failed to load projects" });
});
