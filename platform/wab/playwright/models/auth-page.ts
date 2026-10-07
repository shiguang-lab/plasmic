import { Locator, Page } from "@playwright/test";
import { shiguangSession } from "../utils/shiguang-session";
import { BaseModel } from "./BaseModel";

export class AuthPage extends BaseModel {
  readonly signOutDropdownItem: Locator = this.page.getByRole("menuitem", {
    name: "Sign Out",
    exact: true,
  });

  constructor(page: Page) {
    super(page);
  }

  async authenticate(email: string) {
    const baseURL =
      process.env.WAB_HOST || "https://studio.plasmic.shiguanglab.com";
    await this.page.context().addCookies([shiguangSession(email, baseURL)]);
    await this.page.goto(baseURL);
  }

  async logout() {
    await this.page.locator('[data-test-id="btn-dashboard-user"]').click();
    await this.signOutDropdownItem.waitFor({ state: "visible" });
    await this.signOutDropdownItem.click();
  }
}
