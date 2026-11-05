import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import * as hosting from "@/wab/client/utils/app-hosting-utils";

afterEach(() => vi.unstubAllGlobals());

it.each([false, true])("the first canvas consumes the original Host prefetch (immutable=%s)", async (immutable) => {
  vi.spyOn(hosting, "isImmutableHostPage").mockReturnValue(immutable);
  const pending = Promise.withResolvers<string>();
  const fetchMock = vi.fn(async () => ({ ok: true, text: () => pending.promise }));
  vi.stubGlobal("fetch", fetchMock);
  const headers = { "X-Host-Test": "startup" };
  const url = new URL("/static/host.html", location.href).href;
  const { studioCtx } = fakeStudioCtx({
    devFlagOverrides: { ccStubs: true, defaultHostUrl: url },
    siteInfo: { extraData: { customHostConfig: { headers } } },
  });
  try {
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(url, { redirect: "follow", headers });
    const first = studioCtx.fetchHostPageHtml();
    expect(fetchMock).toHaveBeenCalledOnce();
    if (immutable) {
      expect(studioCtx.fetchHostPageHtml()).toBe(first);
      expect(fetchMock).toHaveBeenCalledOnce();
    }
    pending.resolve("<html><body>Host</body></html>");
    await expect(first).resolves.toContain("Host");
    if (!immutable) {
      await studioCtx.fetchHostPageHtml();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }
  } finally {
    pending.resolve("");
    studioCtx.dispose();
  }
});
