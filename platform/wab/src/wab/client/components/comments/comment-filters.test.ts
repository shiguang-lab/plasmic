import {
  CommentFilters,
  TplCommentThread,
  filterCommentThreads,
} from "@/wab/client/components/comments/utils";
import { toOpaque } from "@/wab/commons/types";
import { ApiComment, ApiUser } from "@/wab/shared/ApiSchema";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { assert, ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite, getDedicatedArena } from "@/wab/shared/core/sites";
import { isTplNamable } from "@/wab/shared/core/tpls";
import { Component } from "@/wab/shared/model/classes";

const self: Pick<ApiUser, "id" | "email"> = {
  id: toOpaque("self"),
  email: "self@example.com",
};
const site = createSite();
const tplMgr = new TplMgr({ site });
const home = tplMgr.addComponent({ name: "Home", type: ComponentType.Page });
const other = tplMgr.addComponent({ name: "Other", type: ComponentType.Page });
const arena = ensure(getDedicatedArena(site, home), "Home arena");
const date = (day: number) => new Date(Date.UTC(2026, 9, day)).toISOString();
const base = {
  createdAt: date(1),
  updatedAt: date(1),
  deletedAt: null,
  createdById: "someone",
  updatedById: "someone",
  deletedById: null,
};

function thread(
  id: string,
  owner: Component | undefined,
  resolved: boolean,
  related: "author" | "mention" | false,
  activity: number,
): TplCommentThread {
  const comment: ApiComment = {
    ...base,
    id: toOpaque(`comment-${id}`),
    commentThreadId: toOpaque(id),
    body: related === "mention" ? "Please check @<self@example.com>" : "Review",
    createdById: related === "author" ? self.id : "someone",
  };
  const subject = owner?.tplTree;
  if (subject) {
    assert(isTplNamable(subject), "Page root should be namable");
  }
  return {
    ...base,
    id: toOpaque(id),
    updatedAt: date(activity),
    resolved,
    label: "Button",
    location: { subject: { iid: "node", uuid: "project" }, variants: [] },
    subjectInfo:
      owner && subject
        ? { ownerComponent: owner, subject, variants: [] }
        : undefined,
    comments: [comment],
    commentThreadHistories: [],
  };
}

const threads = [
  thread("home-mine", home, false, "author", 1),
  thread("home-other", home, false, false, 2),
  thread("home-resolved", home, true, "mention", 3),
  thread("other-mine", other, false, "author", 4),
  thread("other-resolved", other, true, false, 5),
  thread("deleted-subject", undefined, false, "mention", 6),
];

it.each<[CommentFilters["scope"], CommentFilters["status"], boolean, string[]]>(
  [
    ["current", "unresolved", false, ["home-other", "home-mine"]],
    ["current", "unresolved", true, ["home-mine"]],
    ["current", "resolved", false, ["home-resolved"]],
    ["current", "resolved", true, ["home-resolved"]],
    ["current", "all", false, ["home-resolved", "home-other", "home-mine"]],
    ["current", "all", true, ["home-resolved", "home-mine"]],
    [
      "project",
      "unresolved",
      false,
      ["deleted-subject", "other-mine", "home-other", "home-mine"],
    ],
    [
      "project",
      "unresolved",
      true,
      ["deleted-subject", "other-mine", "home-mine"],
    ],
    ["project", "resolved", false, ["other-resolved", "home-resolved"]],
    ["project", "resolved", true, ["home-resolved"]],
    [
      "project",
      "all",
      false,
      [
        "deleted-subject",
        "other-resolved",
        "other-mine",
        "home-resolved",
        "home-other",
        "home-mine",
      ],
    ],
    [
      "project",
      "all",
      true,
      ["deleted-subject", "other-mine", "home-resolved", "home-mine"],
    ],
  ],
)(
  "combines scope=%s, status=%s, related=%s",
  (scope, status, onlyRelated, ids) => {
    expect(
      filterCommentThreads(
        threads,
        { scope, status, onlyRelated },
        arena,
        self,
      ).map((t) => t.id),
    ).toEqual(ids);
  },
);

it("finds comments for every component in a mixed arena without loaded view contexts", () => {
  const mixed = mkMixedArena(
    "Review",
    [home, other].map((component) =>
      mkArenaFrame({ site, name: "", component, width: 100, height: 100 }),
    ),
  );
  expect(
    filterCommentThreads(
      threads,
      { scope: "current", status: "unresolved", onlyRelated: false },
      mixed,
      self,
    ).map((t) => t.id),
  ).toEqual(["other-mine", "home-other", "home-mine"]);
});

it("ignores mentions and participation in deleted replies", () => {
  const item = thread("deleted-reply", home, false, false, 1);
  item.comments.push({
    ...base,
    id: toOpaque("deleted"),
    commentThreadId: item.id,
    createdById: self.id,
    body: "@<self@example.com>",
    deletedAt: date(2),
  });
  expect(
    filterCommentThreads(
      [item],
      { scope: "current", status: "all", onlyRelated: true },
      arena,
      self,
    ),
  ).toEqual([]);
});

it("sorts by the latest reply edit or resolution activity without mutating the source", () => {
  const replied = thread("replied", home, false, false, 1);
  replied.comments.push({
    ...base,
    id: toOpaque("reply"),
    commentThreadId: replied.id,
    body: "Updated reply",
    updatedAt: date(9),
  });
  const resolved = thread("resolved", other, true, false, 2);
  resolved.commentThreadHistories.push({
    ...base,
    id: toOpaque("history"),
    commentThreadId: resolved.id,
    resolved: true,
    createdAt: date(10),
  });
  const source = [replied, resolved];
  expect(
    filterCommentThreads(
      source,
      { scope: "project", status: "all", onlyRelated: false },
      arena,
      self,
    ).map((t) => t.id),
  ).toEqual(["resolved", "replied"]);
  expect(source.map((t) => t.id)).toEqual(["replied", "resolved"]);
});
