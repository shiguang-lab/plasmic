import {
  HOSTLESS_PKGS_KEY,
  addInstalledHostlessPkg,
  clearInstalledHostlessPkgs,
  createHostlessPkgsStore,
  hasInstalledHostlessPkg,
  installedHostlessPkgs,
  removeInstalledHostlessPkg,
} from "@/wab/client/studio-ctx/hostless-pkgs-state";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelRevisions } from "@/wab/shared/model-revisions";

/**
 * `installedHostLessPkgs` was an `observable.set`. Writes now bump the
 * `hostlessPkgs` revision key so revision-keyed derivations (the custom-functions
 * schema) recompute once the packages land.
 */

beforeEach(() => {
  revisions.dispose(); revisions = new ModelRevisions();
});

function fakeStudio(): StudioCtx {
  return { modelRevisions: revisions, hostlessPkgsStore: createHostlessPkgsStore() } as unknown as StudioCtx;
}

it("adds, checks, removes and clears packages", () => {
  const studio = fakeStudio();

  expect(hasInstalledHostlessPkg(studio, "antd5")).toBe(false);
  addInstalledHostlessPkg(studio, "antd5");
  addInstalledHostlessPkg(studio, "antd5");
  expect(hasInstalledHostlessPkg(studio, "antd5")).toBe(true);
  expect([...installedHostlessPkgs(studio)]).toEqual(["antd5"]);

  removeInstalledHostlessPkg(studio, "antd5");
  expect(hasInstalledHostlessPkg(studio, "antd5")).toBe(false);

  addInstalledHostlessPkg(studio, "plume");
  clearInstalledHostlessPkgs(studio);
  expect([...installedHostlessPkgs(studio)]).toEqual([]);
});

it("bumps the hostless revision key on every effective write", () => {
  const studio = fakeStudio();
  expect(revisions.getModelRevision(HOSTLESS_PKGS_KEY)).toBe(0);

  addInstalledHostlessPkg(studio, "antd5");
  revisions.flushModelRevisions();
  expect(revisions.getModelRevision(HOSTLESS_PKGS_KEY)).toBe(1);

  // No-op write does not bump.
  addInstalledHostlessPkg(studio, "antd5");
  revisions.flushModelRevisions();
  expect(revisions.getModelRevision(HOSTLESS_PKGS_KEY)).toBe(1);

  removeInstalledHostlessPkg(studio, "missing");
  revisions.flushModelRevisions();
  expect(revisions.getModelRevision(HOSTLESS_PKGS_KEY)).toBe(1);

  removeInstalledHostlessPkg(studio, "antd5");
  revisions.flushModelRevisions();
  expect(revisions.getModelRevision(HOSTLESS_PKGS_KEY)).toBe(2);
});

let revisions = new ModelRevisions();
