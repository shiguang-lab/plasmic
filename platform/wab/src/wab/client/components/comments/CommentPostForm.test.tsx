import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import CommentPostForm from "@/wab/client/components/comments/CommentPostForm";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { TopFrameApi } from "@/wab/client/frame-ctx/top-frame-api";
import { UserMentionDisplay } from "@/wab/client/components/user-mentions/UserMentionDisplay";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { toOpaque } from "@/wab/commons/types";
import type { ApiPermission, ApiUser, GetProjectResponse } from "@/wab/shared/ApiSchema";
import { ensureInstance } from "@/wab/shared/common";
import { getUniqueUsersFromApiPermissions } from "@/wab/shared/perms";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { mock } from "vitest-mock-extended";

const studios = new Set<StudioCtx>();
afterEach(async () => {
  cleanup();
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks();
});
const projectId = toOpaque<string, "ProjectId">("mention-project");
function user(id: string, displayName: string, email = `${id}@example.test`) {
  return mock<ApiUser>({ id: toOpaque<string, "UserId">(id), email, displayName });
}
function permission(member: ApiUser, accessLevel: ApiPermission["accessLevel"] = "viewer"): ApiPermission {
  return { id: `permission-${member.id}`, projectId, teamId: null, workspaceId: null,
    userId: member.id, email: member.email, user: member, accessLevel };
}
async function setup(perms: ApiPermission[]) {
  const top = mock<TopFrameApi>(); top.componentReuse.mockResolvedValue({ available: false });
  const fixture = fakeStudioCtx({ topFrameApi: top, siteInfo: { id: projectId, perms, isMainBranchProtected: false }, devFlagOverrides: { ccStubs: true } });
  studios.add(fixture.studioCtx);
  await waitFor(() => expect(fixture.studioCtx.initialRouteReady).toBe(true));
  return { ...fixture, studio: fixture.studioCtx };
}
function response(studio: StudioCtx, perms: ApiPermission[]) {
  return Object.assign(mock<GetProjectResponse>(), { project: { ...studio.siteInfo }, perms,
    owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false });
}
async function refresh(f: Awaited<ReturnType<typeof setup>>, perms: ApiPermission[]) {
  f.api.getSiteInfo.mockResolvedValueOnce(response(f.studio, perms));
  await act(async () => { await f.studio.refreshSiteInfo(); });
}
function contents(f: Awaited<ReturnType<typeof setup>>, displayCommits = vi.fn()) {
  return <AppCtxContext.Provider value={f.appCtx}><StudioCtxContext.Provider value={f.studio}>
    <CommentPostForm id="members" initialRows={1} defaultValue="@" />
    <React.Profiler id="mentioned-user" onRender={displayCommits}><UserMentionDisplay email="alice@example.test" defaultEmailDisplay={<span>Unknown member</span>} /></React.Profiler>
  </StudioCtxContext.Provider></AppCtxContext.Provider>;
}
async function openMentions() {
  const input = ensureInstance(document.querySelector("#comment-post-input-members"), HTMLTextAreaElement);
  input.focus(); input.setSelectionRange(1, 1);
  fireEvent.select(input);
  fireEvent.keyUp(input, { key: "ArrowRight" });
  await screen.findByText("bob@example.test");
}

it("projects real permission users immutably and updates mounted mentions for rename/add/remove", async () => {
  const alice = user("alice", "Alice"), bob = user("bob", "Bob");
  const initial = [permission(bob), permission(alice), permission(alice, "editor")];
  const f = await setup(initial), display = vi.fn(); render(contents(f, display));
  const original = f.studio.projectMetadataStore.getState().mentionUsers;
  expect(original.map((member) => member.id)).toEqual(getUniqueUsersFromApiPermissions(initial).map((member) => member.id));
  expect(original).toHaveLength(2); expect(Object.isFrozen(original)).toBe(true);
  expect(original.every((member) => Object.isFrozen(member))).toBe(true);
  expect(Object.keys(original[0]).sort()).toEqual(["displayName", "email", "id"]);
  await openMentions();
  expect(screen.getByText("bob@example.test")).toBeTruthy();
  const renamed = user("alice", "Zoe"), carol = user("carol", "Carol");
  await refresh(f, [permission(renamed), permission(bob)]);
  expect(screen.getAllByText("Zoe").length).toBeGreaterThan(0);
  expect(original[0].displayName).toBe("Alice");
  const renamedUsers = f.studio.projectMetadataStore.getState().mentionUsers;
  expect(renamedUsers[0]).toBe(original[1]);
  expect(renamedUsers.map((member) => member.displayName)).toEqual(["Bob", "Zoe"]);
  display.mockClear();
  await refresh(f, [permission(renamed), permission(carol)]);
  expect(screen.queryByText("bob@example.test")).toBeNull();
  expect(screen.getByText("carol@example.test")).toBeTruthy();
  expect(display).not.toHaveBeenCalled();
  await refresh(f, [permission(carol)]);
  expect(screen.getByText("Unknown member")).toBeTruthy();
  expect(screen.queryByText("alice@example.test")).toBeNull();
});

it("does not publish or rerender mention consumers when only roles or unused user fields change", async () => {
  const alice = user("alice", "Alice"), bob = user("bob", "Bob");
  const f = await setup([permission(alice), permission(bob)]), display = vi.fn(); render(contents(f, display));
  const snapshot = f.studio.projectMetadataStore.getState();
  const published = vi.fn(); const stop = f.studio.projectMetadataStore.subscribe(published);
  try {
    display.mockClear();
    const changedUser = user("alice", "Alice"); changedUser.loginName = "Unrelated login";
    await refresh(f, [permission(changedUser, "editor"), permission(bob, "content")]);
    expect(f.studio.projectMetadataStore.getState()).toBe(snapshot);
    expect(published).not.toHaveBeenCalled(); expect(display).not.toHaveBeenCalled();
    await refresh(f, [permission(changedUser, "editor"), permission(bob, "content")]);
    expect(f.studio.projectMetadataStore.getState()).toBe(snapshot);
    expect(published).not.toHaveBeenCalled(); expect(display).not.toHaveBeenCalled();
  } finally { stop(); }
});

it("rebinds both consumers to a replacement Studio and releases their metadata listeners on unmount", async () => {
  const first = await setup([permission(user("alice", "Alice")), permission(user("bob", "Bob"))]);
  const second = await setup([permission(user("alice", "Second owner")), permission(user("bob", "Second Bob"))]);
  const firstStore = first.studio.projectMetadataStore, secondStore = second.studio.projectMetadataStore;
  const subscribeFirst = firstStore.subscribe.bind(firstStore), subscribeSecond = secondStore.subscribe.bind(secondStore);
  let firstListeners = 0, secondListeners = 0;
  vi.spyOn(firstStore, "subscribe").mockImplementation((notify) => {
    firstListeners++; const stop = subscribeFirst(notify); return () => { firstListeners--; stop(); };
  });
  vi.spyOn(secondStore, "subscribe").mockImplementation((notify) => {
    secondListeners++; const stop = subscribeSecond(notify); return () => { secondListeners--; stop(); };
  });
  const mounted = render(contents(first));
  expect(firstListeners).toBeGreaterThan(0);
  await openMentions();
  mounted.rerender(contents(second));
  expect(screen.getAllByText("Second owner").length).toBeGreaterThan(0);
  expect(firstListeners).toBe(0); expect(secondListeners).toBeGreaterThan(0);
  await refresh(first, [permission(user("alice", "Old owner update"))]);
  expect(screen.queryByText("Old owner update")).toBeNull();
  expect(screen.getAllByText("Second owner").length).toBeGreaterThan(0);
  mounted.unmount();
  expect(firstListeners).toBe(0); expect(secondListeners).toBe(0);
});
