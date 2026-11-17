import { Api, filteredApi } from "@/wab/client/api";
import { PromisifyMethods } from "@/wab/commons/promisify-methods";
import { ProjectId } from "@/wab/shared/ApiSchema";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { mock } from "vitest-mock-extended";

it("allows publishing only the current template through the editor frame bridge", async () => {
  const api = mock<Api>();
  api.publishDesignTemplate.mockResolvedValue({
    template: { id: "template" as ProjectId, published: null },
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
