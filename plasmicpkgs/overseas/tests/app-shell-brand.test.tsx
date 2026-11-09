import { render, waitFor, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { AppShell } from "../src/registerAppShell";

test("keeps composed brand content editable once and synchronizes breadcrumb text while expanded or collapsed", async () => {
  function BrandLabel({ name }: { name: string }) {
    return <strong>{name}</strong>;
  }
  const view = render(<AppShell productName={<BrandLabel name="客服中心" />} />);
  const brand = view.container.querySelector<HTMLElement>("[data-app-shell-product-name]")!;
  await waitFor(() => expect(within(view.getByRole("navigation")).getByText("客服中心")).toBeTruthy());
  expect(view.container.querySelectorAll("[data-app-shell-product-name]")).toHaveLength(1);
  expect(view.getAllByText("客服中心").filter((element) => element.tagName === "STRONG")).toHaveLength(1);
  view.rerender(<AppShell collapsed productName={<BrandLabel name="业务平台" />} />);
  await waitFor(() => expect(within(view.getByRole("navigation")).getByText("业务平台")).toBeTruthy());
  expect(brand.style.display).toBe("none");
  view.rerender(<AppShell productName={<BrandLabel name="新的名称" />} />);
  await waitFor(() => expect(within(view.getByRole("navigation")).getByText("新的名称")).toBeTruthy());
  expect(view.container.querySelector<HTMLElement>("[data-app-shell-product-name]")!).toBe(brand);
});

test("does not copy the empty canvas slot placeholder into the breadcrumb", async () => {
  const view = render(<AppShell productName={<span data-plasmic-slot-placeholder>Slot: Brand</span>} />);
  await waitFor(() => expect(view.queryByRole("navigation")).toBeNull());
});
