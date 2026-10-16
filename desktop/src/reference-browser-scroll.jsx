import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

// The chrome keeps its DOM event handlers; the shared component owns scrolling.
window.referenceBrowserUi = {
  mountScrollArea(host, horizontal = false) {
    const content = document.createElement("div");
    content.className = "scroll-content";
    content.append(...host.childNodes);
    flushSync(() =>
      createRoot(host).render(
        <Scrollbar
          scrollX={horizontal}
          scrollY={!horizontal}
          defer={false}
          style={{ height: "100%", width: "100%" }}
        >
          <div ref={(node) => node?.append(content)} />
        </Scrollbar>,
      ),
    );
  },
};
