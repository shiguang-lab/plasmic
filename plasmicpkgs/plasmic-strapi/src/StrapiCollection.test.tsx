// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { StrapiCollection } from "./StrapiCollection";
import { StrapiCredentialsProvider } from "./StrapiCredentialsProvider";

const queries = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
vi.mock("@plasmicapp/query", () => ({
  usePlasmicQueryData: () => {
    React.useState(null);
    React.useEffect(() => {
      queries.mounts++;
      return () => { queries.unmounts++; };
    }, []);
    return { data: { data: [] } };
  },
}));
afterEach(cleanup);

it("releases query hooks for missing host or collection and can mount again", () => {
  function Fixture({ host, name }: { host: string; name: string }) {
    return <StrapiCredentialsProvider host={host}><StrapiCollection name={name} noLayout /></StrapiCredentialsProvider>;
  }
  const view = render(<Fixture host="" name="articles" />);
  expect(queries.mounts).toBe(0);
  view.rerender(<Fixture host="https://strapi.example" name="articles" />);
  expect(queries.mounts).toBe(1);
  view.rerender(<Fixture host="https://strapi.example" name="" />);
  expect(queries.unmounts).toBe(1);
  view.rerender(<Fixture host="https://strapi.example" name="articles" />);
  expect(queries.mounts).toBe(2);
  view.rerender(<Fixture host="" name="articles" />);
  expect(queries.unmounts).toBe(2);
});
