# @plasmicapp/query

## Purpose

This is a mini, isomorphic, _component-level_ data-fetching library, built around [swr](https://github.com/vercel/swr).
It lets you fetch data in a React environment client-side or server-side.
On the server, it lets you prefetch data from any component, Suspense-style.

Normally in frameworks like Next.js pages router, you cannot couple your data fetches with your components--you need to fetch at the page-level with `getStaticProps`/`getServerSideProps`.
Component-level fetches would happen client-side instead of server-side (ultimately via a `useEffect` or similar).

Paired with @plasmicapp/prepass, this library allows you to express data fetches directly in your components while prefetching all data on the server-side.

## Usage with Plasmic

Learn more about how this can be used with Plasmic specifically in the docs: https://docs.plasmic.app/learn/data-code-components/.

## Notes

- Version 0.2 targets React 19 and SWR 2. Components that need to detect server prefetching call `usePlasmicPrepass()` unconditionally at the top level. The Hook returns `true` inside `PlasmicPrepassContext` and `false` outside that provider. Non-rendering code receives the prefetching mode explicitly from its caller; the former `isPlasmicPrepass()` export is removed. This avoids accessing React's private dispatcher.

- This library is NOT for React Server Components, only for server rendering environments like Next.js pages router.
- This library is NOT specific to Plasmic in any way.
