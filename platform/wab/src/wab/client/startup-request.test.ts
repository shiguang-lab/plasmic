import { retryStartupRead } from "@/wab/client/startup-request";
import { HttpError } from "@/wab/shared/ApiErrors/ApiError";
import { asyncTimeout } from "@/wab/shared/common";

vi.mock("@/wab/shared/common", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/shared/common")>()),
  asyncTimeout: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => vi.clearAllMocks());

it("recovers a startup read after a temporary IAM 503", async () => {
  const read = vi.fn().mockRejectedValueOnce(new HttpError(503)).mockResolvedValue("ready");
  expect(await retryStartupRead(read)).toBe("ready");
  expect(read).toHaveBeenCalledTimes(2);
  expect(asyncTimeout).toHaveBeenCalledWith(250);
});

it("stops after three service failures and preserves the error", async () => {
  const error = new HttpError(503, "Session store unavailable");
  const read = vi.fn().mockRejectedValue(error);
  await expect(retryStartupRead(read)).rejects.toBe(error);
  expect(read).toHaveBeenCalledTimes(3);
  expect(vi.mocked(asyncTimeout).mock.calls.map(([delay]) => delay)).toEqual([250, 500]);
});

it.each([401, 403, 404, 500])("does not retry non-transient access or application errors (%s)", async (status) => {
  const error = new HttpError(status);
  const read = vi.fn().mockRejectedValue(error);
  await expect(retryStartupRead(read)).rejects.toBe(error);
  expect(read).toHaveBeenCalledOnce();
});
