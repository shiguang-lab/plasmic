import {
  APIRequestContext,
  BrowserContext,
  Page,
  request as playwrightRequest,
} from "@playwright/test";
import { shiguangSession } from "./shiguang-session";

export class ApiClient {
  private dataSourceId: string | undefined = undefined;

  constructor(
    public request: APIRequestContext,
    public baseUrl: string,
  ) {}

  private async withAdminContext<T>(
    operation: (context: APIRequestContext) => Promise<T>,
  ): Promise<T> {
    const context = await playwrightRequest.newContext({
      baseURL: this.baseUrl,
      storageState: {
        cookies: [shiguangSession("admin@admin.example.com", this.baseUrl)],
        origins: [],
      },
      extraHTTPHeaders: { Origin: new URL(this.baseUrl).origin },
    });
    try {
      return await operation(context);
    } finally {
      await context.dispose();
    }
  }

  async authenticate(email: string) {
    this.request = await playwrightRequest.newContext({
      baseURL: this.baseUrl,
      storageState: {
        cookies: [shiguangSession(email, this.baseUrl)],
        origins: [],
      },
      extraHTTPHeaders: { Origin: new URL(this.baseUrl).origin },
    });
    const response = await this.request.get(`${this.baseUrl}/api/v1/auth/self`);
    if (!response.ok() || (await response.json()).user?.email !== email) {
      throw new Error("IAM test session was rejected");
    }
  }

  async logout() {
    await this.request.post(`${this.baseUrl}/api/auth/logout`, {
      headers: { Origin: new URL(this.baseUrl).origin },
    });
  }

  async removeProject(projectId: string) {
    await this.request.delete(`${this.baseUrl}/api/v1/projects/${projectId}`);
  }

  async setupPaidWorkspace(): Promise<string> {
    const teamsRes = await this.request.get(`${this.baseUrl}/api/v1/teams`);
    const team = (await teamsRes.json()).teams.find(
      (t) => t.name === "Test Pro Org",
    );
    if (!team) {
      throw new Error("Seeded paid team not found");
    }

    const workspacesRes = await this.request.get(
      `${this.baseUrl}/api/v1/teams/${team.id}/workspaces`,
    );
    const existing = (await workspacesRes.json()).workspaces[0];
    if (existing) {
      return existing.id;
    }

    const createRes = await this.request.post(
      `${this.baseUrl}/api/v1/workspaces`,
      {
        data: { name: "Paid workspace", teamId: team.id },
        headers: { Origin: new URL(this.baseUrl).origin },
      },
    );
    if (!createRes.ok()) {
      throw new Error(`Failed to create workspace: ${await createRes.text()}`);
    }
    const result = await createRes.json();
    if (result.paywall !== "pass") {
      throw new Error(
        `Workspace creation hit a paywall: ${JSON.stringify(result)}`,
      );
    }
    return result.response.workspace.id;
  }

  async importProjectFromTemplate(bundle: any) {
    const res = await this.request.post(
      `${this.baseUrl}/api/v1/projects/import`,
      {
        data: {
          data: JSON.stringify(bundle),
          keepProjectIdsAndNames: false,
          migrationsStrict: true,
        },
        headers: { Origin: new URL(this.baseUrl).origin },
      },
    );
    return (await res.json()).projectId;
  }

  async setupNewProject({
    skipVisit: _skipVisit = false,
    devFlags = {},
    name,
    email: _email = "user2@example.com",
    inviteOnly,
    skipTours: _skipTours = true,
    workspaceId,
  }: {
    skipVisit?: boolean;
    devFlags?: Record<string, any>;
    name: string;
    email?: string;
    inviteOnly?: boolean;
    skipTours?: boolean;
    workspaceId?: string;
  }): Promise<string> {
    const res = await this.request.post(`${this.baseUrl}/api/v1/projects`, {
      data: {
        name: name ? `[playwright] ${name}` : undefined,
        devFlags,
        workspaceId,
      },
      headers: { Origin: new URL(this.baseUrl).origin },
    });

    const projectId = (await res.json()).project.id;

    if (inviteOnly !== undefined) {
      await this.request.put(`${this.baseUrl}/api/v1/projects/${projectId}`, {
        data: { inviteOnly },
        headers: { Origin: new URL(this.baseUrl).origin },
      });
    }
    return projectId;
  }

  async setupProjectWithHostlessPackages({
    name,
    hostLessPackagesInfo,
    devFlags = {},
  }: {
    name: string;
    hostLessPackagesInfo:
      | (Partial<{
          name: string;
          npmPkg: string[];
          deps?: string[];
          cssImport?: string[];
          minimumReactVersion?: string | null;
        }> & { name: string })
      | (Partial<{
          name: string;
          npmPkg: string[];
          deps?: string[];
          cssImport?: string[];
          minimumReactVersion?: string | null;
        }> & { name: string })[];
    devFlags?: Record<string, any>;
  }): Promise<string> {
    const { project } = await this.createProjectWithHostlessPackages({
      name,
      hostLessPackagesInfo,
      devFlags,
    });
    return project.id;
  }

  /**
   * Publishes hostless packages and returns their project ids, leaving behind
   * the scratch project they were installed into. Point a `hostLessComponents`
   * devflag at one to exercise an install flow (see setE2eDevFlags).
   */
  async publishHostlessPackages(
    args: Parameters<ApiClient["setupProjectWithHostlessPackages"]>[0],
  ): Promise<string[]> {
    return (await this.createProjectWithHostlessPackages(args))
      .hostLessProjectIds;
  }

  private async createProjectWithHostlessPackages({
    name,
    hostLessPackagesInfo,
    devFlags = {},
  }: Parameters<ApiClient["setupProjectWithHostlessPackages"]>[0]): Promise<{
    project: { id: string };
    hostLessProjectIds: string[];
  }> {
    const res = await this.request.post(
      `${this.baseUrl}/api/v1/projects/create-project-with-hostless-packages`,
      {
        data: {
          name,
          hostLessPackagesInfo: Array.isArray(hostLessPackagesInfo)
            ? hostLessPackagesInfo.map((info) => ({
                name: info.name,
                npmPkg: info.npmPkg || [],
                deps: info.deps || [],
                cssImport: info.cssImport || [],
                registerCalls: [],
                minimumReactVersion: info.minimumReactVersion ?? null,
              }))
            : [
                {
                  name: hostLessPackagesInfo.name,
                  npmPkg: hostLessPackagesInfo.npmPkg || [],
                  deps: hostLessPackagesInfo.deps || [],
                  cssImport: hostLessPackagesInfo.cssImport || [],
                  registerCalls: [],
                  minimumReactVersion:
                    hostLessPackagesInfo.minimumReactVersion ?? null,
                },
              ],
          devFlags,
        },
        headers: { Origin: new URL(this.baseUrl).origin },
        timeout: 30000,
      },
    );

    return await res.json();
  }

  async codegen(page: Page) {
    const pathname = await page.evaluate(() => window.location.pathname);
    const projectId = pathname.split("/")[2];

    const response = await this.request.post(
      `/api/v1/projects/${projectId}/code/components`,
      {
        headers: {
          "x-plasmic-api-user": "user2@example.com",
          "x-plasmic-api-token": await this.getApiToken(),
        },
        timeout: 60000,
      },
    );

    return response.json();
  }

  async getApiToken() {
    const response = await this.request.get("/api/v1/settings/apitokens");
    const tokens = await response.json();

    if (tokens.tokens.length > 0) {
      return tokens.tokens[0].token;
    }

    const tokenResponse = await this.request.put("/api/v1/settings/apitokens", {
      headers: { Origin: new URL(this.baseUrl).origin },
    });
    const tokenData = await tokenResponse.json();
    return tokenData.token.token;
  }

  async createPostgresDataSource(
    dsname: string,
    connection: {
      host: string;
      port: string;
      name: string;
      user: string;
      password: string;
    },
  ) {
    const workspaceRes = await this.request.get(
      `${this.baseUrl}/api/v1/personal-workspace`,
      { headers: { Origin: new URL(this.baseUrl).origin } },
    );
    const workspaceId = (await workspaceRes.json()).workspace.id;

    const response = await this.request.post(
      `${this.baseUrl}/api/v1/data-source/sources`,
      {
        data: {
          source: "postgres",
          name: dsname,
          workspaceId: workspaceId,
          credentials: {
            password: connection.password,
          },
          settings: {
            host: connection.host,
            port: connection.port,
            name: connection.name,
            user: connection.user,
          },
        },
        headers: { Origin: new URL(this.baseUrl).origin },
      },
    );
    const result = await response.json();
    this.dataSourceId = result.id;
    return result.id;
  }

  async removeProjectAfterTest(projectId: string | undefined, email: string) {
    if (!projectId) {
      throw new Error("Project ID is required for project removal");
    }
    await this.authenticate(email);
    await this.removeProject(projectId);
  }

  async updateProjectMeta(projectId: string, meta: Record<string, any>) {
    const res = await this.request.put(
      `${this.baseUrl}/api/v1/projects/${projectId}/meta`,
      {
        data: meta,
        headers: { Origin: new URL(this.baseUrl).origin },
      },
    );

    if (!res.ok()) {
      const errorText = await res.text();
      throw new Error(
        `Failed to update project meta: ${res.status()} ${errorText}`,
      );
    }
    return await res.json();
  }

  async createComponentState(
    projectId: string,
    componentId: string,
    state: {
      name: string;
      variableType: string;
      accessType: string;
      initialValue: string;
    },
  ) {
    const response = await this.request.post(
      `${this.baseUrl}/api/v1/projects/${projectId}/components/${componentId}/states`,
      {
        data: {
          name: state.name,
          variableType: state.variableType,
          accessType: state.accessType,
          initialValue: state.initialValue,
        },
        headers: { Origin: new URL(this.baseUrl).origin },
      },
    );

    return await response.json();
  }

  async createFakeDataSource(options?: any) {
    const workspaceRes = await this.request.get(
      `${this.baseUrl}/api/v1/personal-workspace`,
      { headers: { Origin: new URL(this.baseUrl).origin } },
    );
    const workspaceId = (await workspaceRes.json()).workspace.id;

    const fakeDataSourceName = `Fake Data Source ${Date.now()}`;
    const createDataSourceOptions = options ?? {
      source: "fake",
      name: fakeDataSourceName,
      workspaceId: workspaceId,
    };

    const response = await this.request.post(
      `${this.baseUrl}/api/v1/data-source/sources`,
      {
        headers: { Origin: new URL(this.baseUrl).origin },
        data: createDataSourceOptions,
      },
    );

    const result = await response.json();
    this.dataSourceId = result.id;
    return result.id;
  }

  async deleteDataSourceOfCurrentTest() {
    if (this.dataSourceId) {
      await this.request.delete(
        `${this.baseUrl}/api/v1/data-source/sources/${this.dataSourceId}`,
        {
          headers: { Origin: new URL(this.baseUrl).origin },
        },
      );

      this.dataSourceId = undefined;
    }
  }

  async grantProjectPermission(
    projectId: string,
    userEmail: string,
    accessLevel: string = "editor",
  ) {
    const res = await this.request.post(`${this.baseUrl}/api/v1/grant-revoke`, {
      data: {
        grants: [
          {
            email: userEmail,
            accessLevel: accessLevel,
            projectId,
          },
        ],
        revokes: [],
      },
      headers: { Origin: new URL(this.baseUrl).origin },
    });
    return await res.json();
  }

  async setupProjectFromTemplate(
    templateNameOrBundle: string | any,
    options?: {
      keepProjectIdsAndNames?: boolean;
      dataSourceReplacement?: { fakeSourceId: string };
    },
  ) {
    let bundle: any;

    if (typeof templateNameOrBundle === "string") {
      const bundles = require("../bundles");
      bundle =
        bundles.default?.[templateNameOrBundle] ||
        bundles[templateNameOrBundle];

      if (!bundle) {
        throw new Error(`Template ${templateNameOrBundle} not found`);
      }
    } else {
      bundle = templateNameOrBundle;
    }

    const importResponse = await this.request.post(
      `${this.baseUrl}/api/v1/projects/import`,
      {
        headers: {
          Origin: new URL(this.baseUrl).origin,
        },
        data: {
          data: JSON.stringify(bundle),
          keepProjectIdsAndNames: options?.keepProjectIdsAndNames ?? false,
          migrationsStrict: true,
          dataSourceReplacement: options?.dataSourceReplacement,
        },
      },
    );

    if (!importResponse.ok()) {
      const errorText = await importResponse.text();
      throw new Error(
        `Failed to import template: ${importResponse.status()} ${errorText}`,
      );
    }
    const importData = await importResponse.json();
    return importData.projectId;
  }

  async deleteProjectAndRevisions(projectId: string) {
    return this.withAdminContext(async (context) => {
      await context.delete(
        `${this.baseUrl}/api/v1/admin/delete-project-and-revisions`,
        {
          data: {
            projectId,
          },
          headers: { Origin: new URL(this.baseUrl).origin },
        },
      );
    });
  }

  async getUserEmailVerificationToken(email: string): Promise<string> {
    const response = await this.request.get(
      `${this.baseUrl}/api/v1/auth/getEmailVerificationToken`,
      {
        data: { email },
        headers: { Origin: new URL(this.baseUrl).origin },
      },
    );

    const responseBody = await response.json();
    return responseBody.token;
  }

  async cloneProject(opts: {
    projectId: string;
    name: string;
    workspaceId?: string;
  }): Promise<{ projectId: string; workspaceId: string }> {
    const { projectId, name, workspaceId } = opts;

    const response = await this.request.post(
      `${this.baseUrl}/api/v1/projects/${projectId}/clone`,
      {
        data: { name, workspaceId },
        headers: { Origin: new URL(this.baseUrl).origin },
      },
    );

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(
        `Failed to clone project ${projectId}: ${response.status()} ${errorText}`,
      );
    }

    const result = await response.json();
    return { projectId: result.projectId, workspaceId: result.workspaceId };
  }

  async makeApiClient(
    request: APIRequestContext,
    context: BrowserContext,
    email = "user2@example.com",
  ) {
    const client = new ApiClient(request, this.baseUrl);
    await client.authenticate(email);
    const cookies = await client.request.storageState();

    await context.addCookies(cookies.cookies);
    return client;
  }
}
