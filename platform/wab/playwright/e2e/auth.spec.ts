import { expect } from "@playwright/test";
import { testModels as test } from "../fixtures/test";

test("sign-in redirects to the central account page and preserves the destination", async ({
  page,
}) => {
  await page.context().clearCookies();
  let destination = "";
  await page.route("https://shiguanglab.com/login**", async (route) => {
    destination = route.request().url();
    await route.fulfill({ body: "Central sign-in" });
  });
  await page.goto("/login?continueTo=%2Fprojects%2Fexample");
  await expect.poll(() => destination).not.toBe("");
  const url = new URL(destination);
  expect(url.origin).toBe("https://shiguanglab.com");
  expect(new URL(url.searchParams.get("return_to")!).pathname).toBe(
    "/projects/example",
  );
});
