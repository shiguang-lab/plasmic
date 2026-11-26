import {
  clearFullHeightExpansion,
  observeFullHeightExpansion,
  syncFullHeightExpansion,
} from "@/wab/client/components/canvas/canvas-full-height";

function setMetrics(
  el: HTMLElement,
  metrics: { clientHeight?: number; scrollHeight?: number },
) {
  if (metrics.clientHeight !== undefined) {
    Object.defineProperty(el, "clientHeight", {
      configurable: true,
      value: metrics.clientHeight,
    });
  }
  if (metrics.scrollHeight !== undefined) {
    Object.defineProperty(el, "scrollHeight", {
      configurable: true,
      value: metrics.scrollHeight,
    });
  }
  el.getClientRects = () =>
    [
      {
        top: 0,
        left: 0,
        right: 100,
        bottom: metrics.clientHeight ?? 100,
        width: 100,
        height: metrics.clientHeight ?? 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      },
    ] as unknown as DOMRectList;
}

describe("canvas-full-height", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  it("marks vertically scrolling containers and their constraining ancestors when __wab_root--full-height is active", () => {
    document.body.innerHTML = `
      <div class="__wab_user-body">
        <div class="__wab_root __wab_root--full-height" style="--viewport-height: 844px;">
          <div id="shell" style="display: flex; flex-direction: row; height: 100%; overflow: hidden;">
            <aside id="sider" style="width: 240px; overflow-y: auto;"></aside>
            <div id="main-col" style="display: flex; flex-direction: column; flex: 1;">
              <main id="content" style="flex: 1 1 0%; overflow-y: auto;"></main>
            </div>
          </div>
        </div>
      </div>
    `;

    const userBody = document.querySelector<HTMLElement>(".__wab_user-body")!;
    const shell = document.getElementById("shell")!;
    const sider = document.getElementById("sider")!;
    const mainCol = document.getElementById("main-col")!;
    const content = document.getElementById("content")!;

    setMetrics(shell, { clientHeight: 844, scrollHeight: 844 });
    setMetrics(sider, { clientHeight: 844, scrollHeight: 1400 });
    setMetrics(mainCol, { clientHeight: 844, scrollHeight: 844 });
    setMetrics(content, { clientHeight: 780, scrollHeight: 2000 });

    expect(syncFullHeightExpansion(userBody)).toBe(true);
    expect(content.getAttribute("data-wab-full-expand")).toBe("column-item");
    expect(mainCol.getAttribute("data-wab-full-expand")).toBe("1");
    expect(sider.getAttribute("data-wab-full-expand")).toBe("1");
    expect(shell.getAttribute("data-wab-full-expand")).toBe("1");

    const root = document.querySelector(".__wab_root")!;
    root.classList.remove("__wab_root--full-height");
    expect(syncFullHeightExpansion(userBody)).toBe(true);
    expect(content.hasAttribute("data-wab-full-expand")).toBe(false);
    expect(shell.hasAttribute("data-wab-full-expand")).toBe(false);
  });

  it("expands viewport-constrained shells with overflow: hidden without expanding small decorative overflow: hidden cards or fixed overlays", () => {
    document.body.innerHTML = `
      <div class="__wab_user-body">
        <div class="__wab_root __wab_root--full-height" style="display: flex; flex-direction: column; --viewport-height: 720px;">
          <div id="page" style="height: 720px; overflow: hidden;">
            <div id="card" style="height: 180px; overflow: hidden;"></div>
            <div id="fixed-bar" style="position: fixed; bottom: 0; height: 60px; overflow: auto;"></div>
            <div class="ant-modal">
              <div id="modal-body" style="height: 300px; overflow: auto;"></div>
            </div>
            <textarea id="notes" style="height: 80px; overflow: auto;"></textarea>
          </div>
        </div>
      </div>
    `;

    const userBody = document.querySelector<HTMLElement>(".__wab_user-body")!;
    const page = document.getElementById("page")!;
    const card = document.getElementById("card")!;
    const fixedBar = document.getElementById("fixed-bar")!;
    const modalBody = document.getElementById("modal-body")!;
    const notes = document.getElementById("notes")!;

    setMetrics(page, { clientHeight: 720, scrollHeight: 1800 });
    setMetrics(card, { clientHeight: 180, scrollHeight: 260 });
    setMetrics(fixedBar, { clientHeight: 60, scrollHeight: 200 });
    setMetrics(modalBody, { clientHeight: 300, scrollHeight: 900 });
    setMetrics(notes, { clientHeight: 80, scrollHeight: 240 });

    syncFullHeightExpansion(userBody);

    expect(page.getAttribute("data-wab-full-expand")).toBe("column-item");
    expect(card.hasAttribute("data-wab-full-expand")).toBe(false);
    expect(fixedBar.hasAttribute("data-wab-full-expand")).toBe(false);
    expect(modalBody.hasAttribute("data-wab-full-expand")).toBe(false);
    expect(notes.hasAttribute("data-wab-full-expand")).toBe(false);

    expect(clearFullHeightExpansion(userBody)).toBe(true);
    expect(page.hasAttribute("data-wab-full-expand")).toBe(false);
  });

  it("cleans up observers and attributes on dispose", () => {
    document.body.innerHTML = `
      <div class="__wab_user-body">
        <div class="__wab_root __wab_root--full-height" style="display: flex; flex-direction: column; --viewport-height: 600px;">
          <div id="scroller" style="height: 200px; overflow: auto;"></div>
        </div>
      </div>
    `;
    const userBody = document.querySelector<HTMLElement>(".__wab_user-body")!;
    const scroller = document.getElementById("scroller")!;
    setMetrics(scroller, { clientHeight: 200, scrollHeight: 800 });

    const handle = observeFullHeightExpansion(userBody);
    expect(scroller.getAttribute("data-wab-full-expand")).toBe("column-item");

    handle.dispose();
    expect(scroller.hasAttribute("data-wab-full-expand")).toBe(false);
  });

  it("re-scans when media load events cause a container to overflow", async () => {
    document.body.innerHTML = `
      <div class="__wab_user-body">
        <div class="__wab_root __wab_root--full-height" style="display: flex; flex-direction: column; --viewport-height: 600px;">
          <div id="media-box" style="height: 200px; overflow-y: auto;">
            <img id="photo" alt="photo" />
          </div>
        </div>
      </div>
    `;
    const userBody = document.querySelector<HTMLElement>(".__wab_user-body")!;
    const mediaBox = document.getElementById("media-box")!;
    const photo = document.getElementById("photo")!;
    setMetrics(mediaBox, { clientHeight: 200, scrollHeight: 200 });

    const handle = observeFullHeightExpansion(userBody);
    expect(mediaBox.hasAttribute("data-wab-full-expand")).toBe(false);

    setMetrics(mediaBox, { clientHeight: 200, scrollHeight: 540 });
    photo.dispatchEvent(new Event("load", { bubbles: false }));

    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => resolve()),
    );
    expect(mediaBox.getAttribute("data-wab-full-expand")).toBe("column-item");

    handle.dispose();
  });

  it("unwraps display:contents slot wrappers when detecting column-flex scroll items", () => {
    document.body.innerHTML = `
      <div class="__wab_user-body">
        <div class="__wab_root __wab_root--full-height" style="display: flex; flex-direction: column; --viewport-height: 720px;">
          <div id="col" style="display: flex; flex-direction: column; height: 720px; overflow: hidden;">
            <div class="__wab_slot" style="display: contents;">
              <div id="slot-scroller" style="flex: 1 1 0%; min-height: 0; overflow-y: auto;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    const userBody = document.querySelector<HTMLElement>(".__wab_user-body")!;
    const col = document.getElementById("col")!;
    const slotScroller = document.getElementById("slot-scroller")!;
    setMetrics(col, { clientHeight: 720, scrollHeight: 720 });
    setMetrics(slotScroller, { clientHeight: 720, scrollHeight: 1500 });

    syncFullHeightExpansion(userBody);

    expect(slotScroller.getAttribute("data-wab-full-expand")).toBe(
      "column-item",
    );
    expect(col.getAttribute("data-wab-full-expand")).toBe("column-item");
  });

  it("clears stale expansion markers when overflow ends and updates column vs row markers", () => {
    document.body.innerHTML = `
      <div class="__wab_user-body">
        <div class="__wab_root __wab_root--full-height" style="--viewport-height: 720px;">
          <div id="flex-parent" style="display: flex; flex-direction: column;">
            <div id="scroller" style="height: 200px; overflow-y: auto;"></div>
          </div>
        </div>
      </div>
    `;
    const userBody = document.querySelector<HTMLElement>(".__wab_user-body")!;
    const flexParent = document.getElementById("flex-parent")!;
    const scroller = document.getElementById("scroller")!;
    setMetrics(flexParent, { clientHeight: 200, scrollHeight: 200 });
    setMetrics(scroller, { clientHeight: 200, scrollHeight: 600 });

    expect(syncFullHeightExpansion(userBody)).toBe(true);
    expect(scroller.getAttribute("data-wab-full-expand")).toBe("column-item");

    // Repeated sync with no layout change returns false.
    expect(syncFullHeightExpansion(userBody)).toBe(false);

    // Parent switching from column to row flex converts "column-item" -> "1".
    flexParent.style.flexDirection = "row";
    expect(syncFullHeightExpansion(userBody)).toBe(true);
    expect(scroller.getAttribute("data-wab-full-expand")).toBe("1");

    // Shrinking content below overflow clears stale markers while full-height stays active.
    setMetrics(scroller, { clientHeight: 200, scrollHeight: 160 });
    expect(syncFullHeightExpansion(userBody)).toBe(true);
    expect(scroller.hasAttribute("data-wab-full-expand")).toBe(false);
    expect(flexParent.hasAttribute("data-wab-full-expand")).toBe(false);
  });

  it("does not expand short overflow:hidden direct children of __wab_root when --viewport-height is set", () => {
    document.body.innerHTML = `
      <div class="__wab_user-body">
        <div class="__wab_root __wab_root--full-height" style="--viewport-height: 720px;">
          <div id="short-card" style="height: 180px; overflow: hidden;"></div>
        </div>
      </div>
    `;
    const userBody = document.querySelector<HTMLElement>(".__wab_user-body")!;
    const shortCard = document.getElementById("short-card")!;
    setMetrics(shortCard, { clientHeight: 180, scrollHeight: 260 });

    expect(syncFullHeightExpansion(userBody)).toBe(false);
    expect(shortCard.hasAttribute("data-wab-full-expand")).toBe(false);
  });
});
