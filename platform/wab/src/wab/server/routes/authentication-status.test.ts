import { DbMgr } from "@/wab/server/db/DbMgr";
import { DependencyModelResource } from "@/wab/server/entities/CustomEntities";
import { Pkg, Project } from "@/wab/server/entities/Entities";
import { addCommentsRoutes } from "@/wab/server/routes/comments";
import { getDependencyModelResource } from "@/wab/server/routes/dependency-model-resources";
import { getHostlessLibraryCanvas } from "@/wab/server/routes/hostless-library-artifacts";
import { getPresentation } from "@/wab/server/routes/presentations";
import { getPreviewPublication } from "@/wab/server/routes/preview-publications";
import {
  computeNextProjectVersion,
  getPkgVersion,
  getProjectRev,
  getProjectRevision,
  listUnpublishedProjectRevisions,
} from "@/wab/server/routes/projects";
import { getTeamById } from "@/wab/server/routes/teams";
import { getWorkspace } from "@/wab/server/routes/workspaces";
import { ApiError } from "@/wab/shared/ApiErrors/ApiError";
import { transformErrors } from "@/wab/shared/ApiErrors/errors";
import { DEVFLAGS } from "@/wab/shared/devflags";
import express from "express";
import "express-async-errors";
import type { AddressInfo } from "net";
import { Connection, EntityManager, Repository } from "typeorm";
import { mockDeep } from "vitest-mock-extended";

const project = Object.assign(new Project(), {
  id: "private-project",
  createdById: "owner",
  inviteOnly: true,
  defaultAccessLevel: "viewer",
  projectApiToken: "read-token",
});
let baseUrl: string;
let server: ReturnType<ReturnType<typeof express>["listen"]>;
const catalog = DEVFLAGS.hostLessComponents;

let manager: EntityManager;
beforeEach(() => {
  manager = new EntityManager(mockDeep<Connection>());
  const packages = mockDeep<Repository<Pkg>>();
  packages.findOne.mockResolvedValue(
    Object.assign(new Pkg(), { id: "package", projectId: project.id }),
  );
  const resources = mockDeep<Repository<DependencyModelResource>>();
  resources.findOne.mockResolvedValue(
    Object.assign(new DependencyModelResource(), {
      id: "resource",
      pkgId: "package",
    }),
  );
  vi.spyOn(manager, "getRepository").mockImplementation((entity: any): any => {
    if (entity === Pkg) {
      return packages;
    }
    if (entity === DependencyModelResource) {
      return resources;
    }
    throw new Error(`Unexpected repository ${entity.name}`);
  });
  vi.spyOn(manager, "findOne").mockImplementation(
    async (entity: any): Promise<any> =>
      entity === Project ? project : undefined,
  );
  vi.spyOn(DbMgr.prototype, "tryGetProjectById").mockImplementation(
    async () => project,
  );
  vi.spyOn(
    DbMgr.prototype as any,
    "_getActorAccessLevelToProject",
  ).mockResolvedValue("blocked");
  vi.spyOn(
    DbMgr.prototype as any,
    "_getActorAccessLevelToResources",
  ).mockResolvedValue({});
  vi.spyOn(DbMgr.prototype as any, "describeActor").mockResolvedValue(
    "Signed-in user",
  );
  vi.spyOn(DbMgr.prototype, "tryGetDevFlagOverrides").mockResolvedValue(
    undefined,
  );
  DEVFLAGS.hostLessComponents = [
    {
      type: "hostless-package",
      name: "Private library",
      codeName: "private-library",
      projectId: [project.id],
      hasCodeArtifacts: true,
      sectionLabel: "Private",
      items: [],
    },
  ] as typeof catalog;
});

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.cookies = {};
    req.body ??= {};
    req.noTxMgr = manager;
    if (req.headers["x-test-signed-in"] === "true") {
      req.user = { id: "user" } as typeof req.user;
    }
    next();
  });
  addCommentsRoutes(app);
  app.get("/api/v1/projects/:projectBranchId", getProjectRev);
  app.get(
    "/api/v1/projects/:projectId/revs/unpublished",
    listUnpublishedProjectRevisions,
  );
  app.get("/api/v1/projects/:projectId/revs/:revisionId", getProjectRevision);
  app.get("/api/v1/pkgs/:pkgId", getPkgVersion);
  app.get("/api/v1/dependency-models/:resourceId", getDependencyModelResource);
  app.get("/api/v1/hostless-libraries/:name/canvas", getHostlessLibraryCanvas);
  app.get("/api/v1/workspaces/:workspaceId", getWorkspace);
  app.get("/api/v1/teams/:teamId", getTeamById);
  app.get("/api/v1/presentations/:code", getPresentation);
  app.get(
    "/api/v1/projects/:projectId/preview-publication",
    getPreviewPublication,
  );
  app.post(
    "/api/v1/projects/:projectId/next-publish-version",
    computeNextProjectVersion,
  );
  app.use(((error, _req, res, _next) => {
    const converted = transformErrors(error);
    res
      .status(converted instanceof ApiError ? converted.statusCode : 500)
      .json({ error: { ...converted, message: converted.message } });
  }) as express.ErrorRequestHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});

afterAll(async () => {
  DEVFLAGS.hostLessComponents = catalog;
  vi.restoreAllMocks();
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

const paths = [
  "/comments/private-project",
  "/projects/private-project",
  "/projects/private-project/revs/unpublished",
  "/projects/private-project/revs/revision",
  "/pkgs/package",
  "/dependency-models/resource",
  "/hostless-libraries/private-library/canvas?version=1.0.0",
  "/workspaces/workspace",
  "/teams/team",
  "/presentations/0123456789",
  "/projects/private-project/preview-publication",
];

test.each(paths)(
  "missing login produces HTTP 401 through the actual handler: %s",
  async (path) => {
    const response = await fetch(baseUrl + path);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { name: "UnauthorizedError", statusCode: 401 },
    });
  },
);

test.each(paths)(
  "signed-in callers without access still receive HTTP 403: %s",
  async (path) => {
    const response = await fetch(baseUrl + path, {
      headers: { "x-test-signed-in": "true" },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { name: "ForbiddenError", statusCode: 403 },
    });
  },
);

test("public presentation access works without login", async () => {
  project.inviteOnly = false;
  project.defaultAccessLevel = "viewer";
  try {
    const response = await fetch(baseUrl + "/presentations/0123456789");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ projectId: project.id });
  } finally {
    project.inviteOnly = true;
    project.defaultAccessLevel = "viewer";
  }
});

test("a valid project token works without a user cookie, invalid tokens remain permission failures", async () => {
  for (const [token, status] of [
    ["read-token", 200],
    ["invalid", 403],
  ] as const) {
    const response = await fetch(baseUrl + "/presentations/0123456789", {
      headers: { "x-plasmic-api-project-tokens": `${project.id}:${token}` },
    });
    expect(response.status).toBe(status);
  }
});

test.each([
  [false, 401],
  [true, 403],
] as const)(
  "publish requests fail before doing work: signed in=%s",
  async (signedIn, status) => {
    const response = await fetch(
      baseUrl + "/projects/private-project/next-publish-version",
      {
        method: "POST",
        headers: signedIn ? { "x-test-signed-in": "true" } : {},
      },
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({
      error: { statusCode: status },
    });
  },
);

test("publish policy rejection remains 403 for a signed-in project editor", async () => {
  vi.mocked(
    (DbMgr.prototype as any)._getActorAccessLevelToProject,
  ).mockResolvedValue("editor");
  const response = await fetch(
    baseUrl + "/projects/private-project/next-publish-version",
    {
      method: "POST",
      headers: { "x-test-signed-in": "true" },
    },
  );
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({
    error: { name: "ForbiddenError", message: "Access denied" },
  });
});
