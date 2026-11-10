import type { GetProjectResponse, ProjectOpeningResponse } from "@/wab/shared/ApiSchema";
import type { Bundle } from "@/wab/shared/bundler";
import { assert } from "@/wab/shared/common";
import * as Comlink from "comlink";

type ProjectModelSource = {
  project: Omit<GetProjectResponse, "depPkgs">;
  dependencies: {
    info: Omit<ProjectOpeningResponse["depPkgs"][number], "modelResourceId">;
    bytes: ArrayBuffer;
  }[];
};

/** One authorized startup payload. Only the model-owning Host decodes it. */
export class StartupProjectModel {
  constructor(readonly source: ProjectModelSource) {}
}

Comlink.transferHandlers.set("PROJECT_MODEL", {
  canHandle: (value): value is StartupProjectModel => value instanceof StartupProjectModel,
  serialize: (value: GetProjectResponse | StartupProjectModel) => {
    assert(value instanceof StartupProjectModel, "Expected a prefetched project model");
    return [value.source, [...new Set(value.source.dependencies.map(({ bytes }) => bytes))]];
  },
  deserialize: ({ project, dependencies }): GetProjectResponse => {
    const decoder = new TextDecoder();
    const models = new Map<ArrayBuffer, Bundle>();
    return {
      ...project,
      depPkgs: dependencies.map(({ info, bytes }) => {
        let model = models.get(bytes);
        if (!model) {
          const decoded: Bundle = JSON.parse(decoder.decode(bytes));
          models.set(bytes, decoded);
          model = decoded;
        }
        return { ...info, model };
      }),
    };
  },
} satisfies Comlink.TransferHandler<GetProjectResponse | StartupProjectModel, ProjectModelSource>);
