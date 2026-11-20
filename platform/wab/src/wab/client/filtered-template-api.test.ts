import { Api, filteredApi } from "@/wab/client/api";
import { restrictPublishedTemplateFrameApi } from "@/wab/client/frame-ctx/top-frame-ctx";
import { PromisifyMethods } from "@/wab/commons/promisify-methods";
import { CommentThreadId, ProjectId, RootCommentData, ThreadCommentData } from "@/wab/shared/ApiSchema";
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
  const publishedApi = restrictPublishedTemplateFrameApi(api, history, "template", "2.0.0");
  for (const method of [
    "saveProjectRevChanges", "publishDesignTemplate", "getModelUpdates",
    "listProjectBranches", "getPkgVersion", "editComment", "deleteThread", "openDesktopBrowser",
  ]) {
    expect(publishedApi).not.toHaveProperty(method);
  }
  const projectId = "template" as ProjectId;
  await publishedApi.getComments(projectId, undefined);
  expect(api.getComments).toHaveBeenCalledExactlyOnceWith(projectId, undefined, "2.0.0");
  const root = mock<RootCommentData>();
  const reply = mock<ThreadCommentData>();
  const threadId = "thread" as CommentThreadId;
  await publishedApi.postRootComment(projectId, undefined, root);
  await publishedApi.postThreadComment(projectId, undefined, threadId, reply);
  expect(api.postRootComment).toHaveBeenCalledExactlyOnceWith(projectId, undefined, root, "2.0.0");
  expect(api.postThreadComment).toHaveBeenCalledExactlyOnceWith(projectId, undefined, threadId, reply, "2.0.0");
  expect(() => publishedApi.getComments("other" as ProjectId, undefined)).toThrow("published template");
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
