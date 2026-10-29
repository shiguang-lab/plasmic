import { registerPresentationProject } from "@/wab/client/route/presentation-projects";
import {
  isHostFrame,
  isTopFrame,
  parseProjectLocation as parseProjectLocationActual,
} from "@/wab/client/cli-routes";
import { DEVFLAGS } from "@/wab/shared/devflags";
import {
  ProjectLocationParams,
  mkProjectLocation,
} from "@/wab/shared/route/app-routes";
import { Location } from "history";

/** parseProjectLocation that makes it easier to specify a Location object. */
function parseProjectLocation({
  pathname = "",
  search = "",
  hash = "",
  key = "",
  state,
}: Partial<Location>) {
  return parseProjectLocationActual({
    pathname,
    search,
    hash,
    key,
    state,
  });
}

describe("mkProjectLocation/parseProjectLocation", () => {
  it("does not parse non-exact-matching paths", () => {
    expect(
      parseProjectLocation({ pathname: "/wrong-pathname" }),
    ).toBeUndefined();
    expect(
      parseProjectLocation({ pathname: "/projects/PROJECT_ID/docs" }),
    ).toBeUndefined();
    expect(
      parseProjectLocation({
        pathname: "/projects/PROJECT_ID/missing-hyphen/slug",
      }),
    ).toBeUndefined();
  });
  it("ignores unknown arena type", () => {
    expect(
      parseProjectLocation({
        pathname: "/projects/PROJECT_ID",
        search: "?arena_type=focusedframe&arena=ARENA_UUID",
      }),
    ).toEqual({
      projectId: "PROJECT_ID",
      slug: undefined,
      branchName: "main",
      branchVersion: "latest",
      arenaType: undefined,
      arenaUuidOrNameOrPath: "ARENA_UUID",
    });
  });
  it("ignores unknown search params and hash", () => {
    expect(
      parseProjectLocation({
        pathname: "/projects/PROJECT_ID",
        search: "?unknown=search&params",
        hash: "#hash-tags-ignored",
      }),
    ).toEqual({
      projectId: "PROJECT_ID",
      slug: undefined,
      branchName: "main",
      branchVersion: "latest",
      arenaType: undefined,
      arenaUuidOrNameOrPath: undefined,
    });
  });
  it("makes and parses project locations", () => {
    function expectMkParse(
      expectedParams: ProjectLocationParams,
      expectedLocation: Partial<Location>,
    ) {
      expect(mkProjectLocation(expectedParams)).toEqual(expectedLocation);
      expect(parseProjectLocation(expectedLocation)).toEqual(expectedParams);
    }
    expectMkParse(
      {
        projectId: "PROJECT_ID",
        slug: undefined,
        branchRevision: undefined,
        branchName: "main",
        branchVersion: "latest",
        arenaType: undefined,
        arenaUuidOrNameOrPath: undefined,
      },
      {
        pathname: "/projects/PROJECT_ID",
      },
    );
    expectMkParse(
      {
        projectId: "PROJECT_ID",
        slug: "THIS-IS-A-SLUG",
        branchName: "main",
        branchVersion: "latest",
        arenaType: undefined,
        branchRevision: undefined,
        arenaUuidOrNameOrPath: undefined,
      },
      {
        pathname: "/projects/PROJECT_ID/-/THIS-IS-A-SLUG",
      },
    );
    expectMkParse(
      {
        projectId: "PROJECT_ID",
        slug: undefined,
        branchName: "main",
        branchVersion: "latest",
        arenaType: "component",
        branchRevision: undefined,
        arenaUuidOrNameOrPath: "ARENA_UUID",
        threadId: "THREAD_ID",
      },
      {
        pathname: "/projects/PROJECT_ID",
        search: "?arena_type=component&arena=ARENA_UUID&comment=THREAD_ID",
      },
    );
    expectMkParse(
      {
        projectId: "PROJECT_ID",
        slug: "THIS-IS-A-SLUG",
        branchName: "FEATURE",
        branchVersion: "latest",
        branchRevision: undefined,
        arenaType: undefined,
        arenaUuidOrNameOrPath: undefined,
      },
      {
        pathname: "/projects/PROJECT_ID/-/THIS-IS-A-SLUG",
        search: "?branch=FEATURE",
      },
    );
    expectMkParse(
      {
        projectId: "PROJECT_ID",
        slug: "THIS-IS-A-SLUG",
        branchName: "main",
        branchVersion: "1.2.3",
        branchRevision: undefined,
        arenaType: undefined,
        arenaUuidOrNameOrPath: undefined,
      },
      {
        pathname: "/projects/PROJECT_ID/-/THIS-IS-A-SLUG",
        search: "?version=1.2.3",
      },
    );
    expectMkParse(
      {
        projectId: "PROJECT_ID",
        slug: "THIS-IS-A-SLUG",
        branchName: "FEATURE",
        branchVersion: "1.2.3",
        branchRevision: undefined,
        arenaType: "page",
        arenaUuidOrNameOrPath: "ARENA_UUID",
      },
      {
        pathname: "/projects/PROJECT_ID/-/THIS-IS-A-SLUG",
        search:
          "?branch=FEATURE&version=1.2.3&arena_type=page&arena=ARENA_UUID",
      },
    );
    expectMkParse(
      {
        projectId: "PROJECT_ID",
        slug: undefined,
        branchName: "main",
        branchVersion: "latest",
        branchRevision: undefined,
        arenaType: undefined,
        arenaUuidOrNameOrPath: undefined,
        threadId: "THREAD_ID",
      },
      {
        pathname: "/projects/PROJECT_ID",
        search: "?comment=THREAD_ID",
      },
    );

  });

  it("ignores the AI panel query flag", () => {
    for (const pathname of ["/projects/PROJECT_ID", "/projects/PROJECT_ID/preview#/ARENA_UUID"]) {
      expect(parseProjectLocation({ pathname, search: "?copilot_chat=true" })).toEqual(
        parseProjectLocation({ pathname, search: "" }),
      );
    }
  });
  it.each(["/projects/PROJECT_ID/preview", "/d/0123456789"])("parses hash business routes at %s", (pathname) => {
    registerPresentationProject("0123456789", "PROJECT_ID" as import("@/wab/shared/ApiSchema").ProjectId);
    expect(parseProjectLocation({ pathname, search: "?branch=design", hash: "#/groups/a%2Fb?branch=business#rules" })).toEqual({
      projectId: "PROJECT_ID", slug: undefined, arenaType: undefined, branchRevision: undefined,
      branchName: "design", branchVersion: "latest", arenaUuidOrNameOrPath: "/groups/a%2Fb", isPreview: true,
    });
  });
});

it("recognizes the injected host document when its origin matches Studio", () => {
  const urls = DEVFLAGS.topFrameUrls;
  DEVFLAGS.topFrameUrls = [...urls, window.origin];
  const marker = document.createElement("div");
  marker.id = "plasmic-studio-tag";
  try {
    expect(isTopFrame()).toBe(true);
    document.body.appendChild(marker);
    expect(isTopFrame()).toBe(false);
    expect(isHostFrame()).toBe(true);
  } finally {
    marker.remove();
    DEVFLAGS.topFrameUrls = urls;
  }
});
