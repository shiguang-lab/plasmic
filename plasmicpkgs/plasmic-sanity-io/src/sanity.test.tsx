// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { SanityCredentialsProvider, SanityFetcher } from "./sanity";

const queries = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
vi.mock("@plasmicapp/query", () => ({
  usePlasmicQueryData: () => {
    React.useState(null);
    React.useEffect(() => {
      queries.mounts++;
      return () => { queries.unmounts++; };
    }, []);
    return { data: [] };
  },
}));
vi.mock("@sanity/client", () => ({ createClient: () => ({ fetch: vi.fn() }) }));
afterEach(cleanup);

it("mounts and releases query hooks when credentials become valid or invalid", () => {
  function Fixture({ projectId }: { projectId: string }) {
    return <SanityCredentialsProvider projectId={projectId} dataset="production">
      <SanityFetcher docType="article" noLayout />
    </SanityCredentialsProvider>;
  }
  const view = render(<Fixture projectId="" />);
  expect(queries.mounts).toBe(0);
  view.rerender(<Fixture projectId="valid-project" />);
  expect(queries.mounts).toBe(3);
  view.rerender(<Fixture projectId="" />);
  expect(queries.unmounts).toBe(3);
  view.rerender(<Fixture projectId="valid-project" />);
  expect(queries.mounts).toBe(6);
  view.unmount();
  expect(queries.unmounts).toBe(6);
});
