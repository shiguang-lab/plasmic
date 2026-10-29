import { Api, filteredApi } from "@/wab/client/api";
import { PromisifyMethods } from "@/wab/commons/promisify-methods";
import { ProjectId } from "@/wab/shared/ApiSchema";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { mock } from "vitest-mock-extended";

it("exposes presentation calls through the frame bridge without granting access to other projects", async () => {
  const api = mock<Api>();
  api.createPresentation.mockResolvedValue({ projectId: "project" as ProjectId, code: "0123456789" });
  api.getPresentation.mockResolvedValue({ projectId: "project" as ProjectId, code: "0123456789" });
  const filtered = filteredApi("project", api as unknown as PromisifyMethods<Api>, DEVFLAGS);
  expect(await filtered.createPresentation("project" as ProjectId)).toEqual({ projectId: "project", code: "0123456789" });
  expect(await filtered.getPresentation("0123456789")).toEqual({ projectId: "project", code: "0123456789" });
  expect(() => filtered.createPresentation("other" as ProjectId)).toThrow("Unexpected projectId");
  expect(api.createPresentation).toHaveBeenCalledTimes(1);
  api.getPresentation.mockResolvedValue({ projectId: "other" as ProjectId, code: "other12345" });
  await expect(filtered.getPresentation("other12345")).rejects.toThrow("Unexpected projectId");
});
