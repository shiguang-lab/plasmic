import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SliderWrapper } from "./index";

describe("SliderWrapper", () => {
  it("renders each slide once and preserves existing slide className", () => {
    const html = renderToStaticMarkup(
      <SliderWrapper className="slider-root">
        <div className="slide-a">Slide A</div>
        <div className="slide-b">Slide B</div>
      </SliderWrapper>
    );
    expect(html.match(/Slide A/g)).toHaveLength(1);
    expect(html.match(/Slide B/g)).toHaveLength(1);
    expect(html).toContain('class="keen-slider__slide slide-a"');
    expect(html).toContain('class="keen-slider__slide slide-b"');
  });
});
