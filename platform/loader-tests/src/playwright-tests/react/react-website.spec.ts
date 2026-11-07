import { test } from "../../fixtures";
import {
  ReactContext,
  setupReact,
  teardownReact,
} from "../../react/react-setup";
import {
  testWebsiteComponents,
  testWebsiteDesktop,
  testWebsiteMobile,
} from "../helpers/website";

test.describe(`React Website`, () => {
  let ctx: ReactContext;

  test.beforeAll(async () => {
    ctx = await setupReact({
      bundleFile: "plasmic-kit-website-components_16033.json",
      projectName: "PlasmicWebsite",
    });
  });

  test.afterAll(async () => {
    await teardownReact(ctx);
  });

  test(`should render desktop`, async ({ page }) => {
    await testWebsiteDesktop(page, { host: ctx.host });
  });

  test(`should render mobile`, async ({ page }) => {
    await testWebsiteMobile(page, { host: ctx.host });
  });

  test(`should render components`, async ({ page }) => {
    await testWebsiteComponents(page, { host: ctx.host });
  });
});
