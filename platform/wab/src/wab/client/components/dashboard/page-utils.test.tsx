import { act, cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { Helmet } from "react-helmet-async";
import { documentTitle } from "./page-utils";

afterEach(cleanup);
it("keeps page titles through navigation with the React 19-compatible head provider", async () => {
  const previous = document.title;
  const view = render(<>{documentTitle("Projects")}</>);
  try {
    await waitFor(() => expect(document.title).toBe("Projects - Plasmic"));
    view.rerender(<>{documentTitle("Settings")}</>);
    await waitFor(() => expect(document.title).toBe("Settings - Plasmic"));
    view.rerender(<>{documentTitle("")}</>);
    await waitFor(() => expect(document.title).toBe("Plasmic"));
  } finally {
    view.unmount();
    document.title = previous;
  }
});

it("keeps editor text-selection state and font styles scoped to mounted head declarations", async () => {
  const previousClass = document.body.className;
  const view = render(<><Helmet><body className="no-text-select" /><link rel="stylesheet" href="/head-provider-font-test.css" /></Helmet></>);
  try {
    await waitFor(() => expect(document.body.classList.contains("no-text-select")).toBe(true));
    expect(document.querySelector('link[href="/head-provider-font-test.css"]')).toBeTruthy();
    await act(async () => view.unmount());
    await waitFor(() => expect(document.body.classList.contains("no-text-select")).toBe(false));
    expect(document.querySelector('link[href="/head-provider-font-test.css"]')).toBeNull();
  } finally {
    document.body.className = previousClass;
  }
});
