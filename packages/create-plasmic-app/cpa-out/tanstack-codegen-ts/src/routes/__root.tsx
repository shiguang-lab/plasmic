import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { PlasmicRootProvider } from "@plasmicapp/react-web"
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: () => (
    <>
      <HeadContent />
      <PlasmicRootProvider>
        <Outlet />
        <TanStackRouterDevtools />
      </PlasmicRootProvider>
      <Scripts />
    </>
  ),
})

