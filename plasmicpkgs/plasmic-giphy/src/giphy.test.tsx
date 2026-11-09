// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Giphy } from "./giphy";

const state = vi.hoisted(() => ({ id: "first", gif: vi.fn() }));
vi.mock("./hooks/useFetch", () => ({ useFetch: () => state.id }));
vi.mock("@giphy/js-fetch-api", () => ({ GiphyFetch: class { gif = state.gif; } }));
afterEach(cleanup);
it("keeps the current GIF when details for an old result arrive later", async () => {
  const responses: ((value: unknown) => void)[] = [];
  state.gif.mockImplementation(() => new Promise((resolve) => responses.push(resolve)));
  const view = render(<Giphy searchTerm="first" className="gif" />);
  state.id = "second";
  view.rerender(<Giphy searchTerm="second" className="gif" />);
  await act(async () => responses[1]({ data: { images: { downsized_medium: { url: "https://example.com/new.gif" } } } }));
  await act(async () => responses[0]({ data: { images: { downsized_medium: { url: "https://example.com/old.gif" } } } }));
  expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/new.gif");
});

it("keeps the last rendered GIF visible while another result loads or the search is cleared", async () => {
  const responses: ((value: unknown) => void)[] = [];
  state.id = "loaded";
  state.gif.mockReset().mockImplementation(() => new Promise((resolve) => responses.push(resolve)));
  const view = render(<Giphy searchTerm="loaded" className="gif" />);
  await act(async () => responses[0]({ data: { images: { downsized_medium: { url: "https://example.com/loaded.gif" } } } }));
  state.id = "pending";
  view.rerender(<Giphy searchTerm="pending" className="gif" />);
  expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/loaded.gif");
  state.id = "";
  view.rerender(<Giphy searchTerm="" className="gif" />);
  expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/loaded.gif");
  await act(async () => responses[1]({ data: { images: { downsized_medium: { url: "https://example.com/retired.gif" } } } }));
  expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/loaded.gif");
});
