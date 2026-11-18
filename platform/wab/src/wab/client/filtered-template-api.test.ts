import { Api, filteredApi } from "@/wab/client/api";
import { restrictPublishedTemplateFrameApi } from "@/wab/client/frame-ctx/top-frame-ctx";
import { PromisifyMethods } from "@/wab/commons/promisify-methods";
import { ProjectId } from "@/wab/shared/ApiSchema";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { createMemoryHistory } from "history";
import { mock } from "vitest-mock-extended";

it("allows publishing only the current template through the editor frame bridge", async () => {
  const api = mock<Api>();
  api.publishDesignTemplate.mockResolvedValue({
    template: {
      id: "template" as ProjectId,
      metadata: {
        name: "Template",
        description: "",
        kind: "page",
        device: "mobile",
        category: "",
        thumbnailUrl: "",
      },
      published: null,
    },
  });
  const filtered = filteredApi(
    "template",
    api as unknown as PromisifyMethods<Api>,
    DEVFLAGS,
  );
  await filtered.publishDesignTemplate("template" as ProjectId);
  expect(api.publishDesignTemplate).toHaveBeenCalledWith("template");
  expect(() => filtered.publishDesignTemplate("other" as ProjectId)).toThrow(
    "Unexpected projectId",
  );
  expect(api.publishDesignTemplate).toHaveBeenCalledTimes(1);
});

it("limits the published frame to read capabilities and published navigation", async () => {
  const history = createMemoryHistory({
    initialEntries: ["/projects/template?publishedTemplate=true"],
  });
  const api = mock<Parameters<typeof restrictPublishedTemplateFrameApi>[0]>();
  const publishedApi = restrictPublishedTemplateFrameApi(api, history, "template");
  for (const method of [
    "saveProjectRevChanges", "publishDesignTemplate", "getModelUpdates",
    "listProjectBranches", "getPkgVersion", "postRootComment", "openDesktopBrowser",
  ]) {
    expect(publishedApi).not.toHaveProperty(method);
  }
  expect(() => publishedApi.pushLocation("/projects/template")).toThrow("published view");
  expect(() => publishedApi.replaceLocation("/projects/other", "?publishedTemplate=true")).toThrow("published view");
  expect(api.pushLocation).not.toHaveBeenCalled();
  expect(api.replaceLocation).not.toHaveBeenCalled();

  await publishedApi.pushLocation("/projects/template/preview", "?publishedTemplate=true", "#/calculator");
  await publishedApi.replaceLocation("/template-center");
  expect(api.pushLocation).toHaveBeenCalledExactlyOnceWith(
    "/projects/template/preview", "?publishedTemplate=true", "#/calculator",
  );
  expect(api.replaceLocation).toHaveBeenCalledExactlyOnceWith("/template-center", undefined, undefined);
});
