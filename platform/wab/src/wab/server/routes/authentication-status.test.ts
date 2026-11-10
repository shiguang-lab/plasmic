import { DbMgr } from "@/wab/server/db/DbMgr";
import { DependencyModelResource } from "@/wab/server/entities/CustomEntities";
import { Pkg, Project } from "@/wab/server/entities/Entities";
import { addCommentsRoutes } from "@/wab/server/routes/comments";
import { getDependencyModelResource } from "@/wab/server/routes/dependency-model-resources";
import { getHostlessLibraryCanvas } from "@/wab/server/routes/hostless-library-artifacts";
import { getPresentation } from "@/wab/server/routes/presentations";
import { presentationAccess } from "@/wab/server/routes/presentation-access";
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
import { userDbMgr } from "@/wab/server/routes/util";
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
  presentationCode: "0123456789",
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
      model: JSON.stringify({ version: "test", map: {} }),
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
    async (entity: any, where?: any): Promise<any> =>
      entity === Project && (!where?.presentationCode || (where.presentationCode === project.presentationCode && !project.deletedAt)) ? project : undefined,
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
  vi.spyOn(DbMgr.prototype, "getLatestProjectRev").mockResolvedValue({ data: JSON.stringify({ deps: [] }) } as any);
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
  app.use(presentationAccess);
  app.get("/api/v1/projects/:projectId/branches", async (req, res) => {
    await userDbMgr(req).checkProjectPerms(req.params.projectId, "viewer", "read branches");
    res.json({ branches: [] });
  });
  app.post("/api/v1/projects/:projectId", async (req, res) => {
    await userDbMgr(req).checkProjectPerms(req.params.projectId, "editor", "save");
    res.json({});
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

test("private presentation access works without login", async () => {
  const response = await fetch(baseUrl + "/presentations/0123456789");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ code: "0123456789", projectId: project.id });
  expect(project.inviteOnly).toBe(true);
});

test("the presentation code grants reads without a user cookie and never grants writes", async () => {
  const headers = { "x-plasmic-presentation-code": "0123456789" };
  const read = await fetch(baseUrl + "/projects/private-project/branches", { headers });
  expect(read.status).toBe(200);
  const write = await fetch(baseUrl + "/projects/private-project", { method: "POST", headers });
  expect(write.status).toBe(401);
  const noCode = await fetch(baseUrl + "/projects/private-project/branches");
  expect(noCode.status).toBe(401);
  const unrelated = await fetch(baseUrl + "/projects/other-project/branches", { headers });
  expect(unrelated.status).toBe(403);
  const signedInWrite = await fetch(baseUrl + "/projects/private-project", { method: "POST", headers: { ...headers, "x-test-signed-in": "true" } });
  expect(signedInWrite.status).toBe(403);
});

test("the immutable model handler accepts presentation access and still rejects anonymous requests without the code", async () => {
  const response = await fetch(baseUrl + "/dependency-models/resource", {
    headers: { "x-plasmic-presentation-code": "0123456789" },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ version: "test", map: {} });
  expect((await fetch(baseUrl + "/dependency-models/resource")).status).toBe(401);
});

test.each(["bad-code", "abcdefghij"])("rejects an invalid or unknown presentation code: %s", async code => {
  const response = await fetch(baseUrl + "/projects/private-project/branches", {
    headers: { "x-plasmic-presentation-code": code },
  });
  expect(response.status).toBe(404);
});

test("deleted projects cannot be resolved or loaded with a presentation code", async () => {
  project.deletedAt = new Date();
  try {
    for (const path of ["/presentations/0123456789", "/projects/private-project/branches"]) {
      const response = await fetch(baseUrl + path, { headers: { "x-plasmic-presentation-code": "0123456789" } });
      expect(response.status).toBe(404);
    }
  } finally { project.deletedAt = null; }
});

test("a valid project token works without a user cookie, invalid tokens remain permission failures", async () => {
  for (const [token, status] of [
    ["read-token", 200],
    ["invalid", 403],
  ] as const) {
    const response = await fetch(baseUrl + "/projects/private-project/branches", {
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
