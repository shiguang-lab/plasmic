import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { expect, test, vi } from "vitest";
import { AntdPagination } from "../src/registerPagination";

const paginatedUrl = (page: number, size: number) =>
  `/records?page=${page}&size=${size}`;

test.each(["pointer", "Enter"])(
  "SEO pagination preserves native %s page changes",
  async (activation) => {
    const onChange = vi.fn();
    render(
      <AntdPagination current={1} pageSize={10} total={30}
        paginatedUrl={paginatedUrl} onChange={onChange} />
    );
    const page = screen.getByRole("link", { name: "Page 2", exact: true });
    expect(page.getAttribute("href")).toBe("/records?page=2&size=10");
    expect(page.getAttribute("rel")).toBe("next");
    expect(onChange).not.toHaveBeenCalled();
    const user = userEvent.setup();
    if (activation === "pointer") {
      await user.click(page);
    } else {
      page.focus();
      await user.keyboard("{Enter}");
    }
    expect(onChange).toHaveBeenCalledExactlyOnceWith(2, 10);
  }
);

test.each([false, true])(
  "SEO links prevent browser navigation and retain disabled=%s behavior",
  (disabled) => {
    const onChange = vi.fn();
    render(
      <AntdPagination current={1} pageSize={10} total={30} disabled={disabled}
        paginatedUrl={paginatedUrl} onChange={onChange} />
    );
    const page = screen.getByRole("link", { name: "Page 2", exact: true });
    const event = createEvent.click(page, { bubbles: true, cancelable: true });
    fireEvent(page, event);
    expect(event.defaultPrevented).toBe(true);
    if (disabled) {
      expect(onChange).not.toHaveBeenCalled();
    } else {
      expect(onChange).toHaveBeenCalledExactlyOnceWith(2, 10);
    }
  }
);


test("plain pagination retains native Space activation", async () => {
  const onChange = vi.fn();
  render(<AntdPagination current={1} pageSize={10} total={30} onChange={onChange} />);
  screen.getByRole("button", { name: "Page 2", exact: true }).focus();
  await userEvent.setup().keyboard(" ");
  expect(onChange).toHaveBeenCalledExactlyOnceWith(2, 10);
});
