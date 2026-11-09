import { createPortalTunnel, PortalTunnelIn, PortalTunnelOut } from "@/wab/client/components/portal-tunnel";
import { render, screen } from "@testing-library/react";
import * as React from "react";

it("keeps destinations isolated and retains source context through native portals", () => {
  const first = createPortalTunnel(), second = createPortalTunnel();
  const Context = React.createContext("outside");
  function Content() { return <span>{React.useContext(Context)}</span>; }
  const contents = (showFirst: boolean) => <React.StrictMode>
    <Context.Provider value="First"><PortalTunnelIn tunnel={first}><Content /></PortalTunnelIn></Context.Provider>
    <Context.Provider value="Second"><PortalTunnelIn tunnel={second}><Content /></PortalTunnelIn></Context.Provider>
    {showFirst && <PortalTunnelOut tunnel={first} className="first" />}
    <PortalTunnelOut tunnel={second} className="second" />
  </React.StrictMode>;
  const mounted = render(contents(true));
  try {
    expect(screen.getByText("First").closest(".first")).not.toBeNull();
    expect(screen.getByText("Second").closest(".second")).not.toBeNull();
    mounted.rerender(contents(false));
    expect(screen.queryByText("First")).toBeNull();
    expect(screen.getByText("Second").closest(".second")).not.toBeNull();
    expect(first.getState()).toBeNull();
    mounted.rerender(contents(true));
    expect(screen.getByText("First").closest(".first")).not.toBeNull();
  } finally { mounted.unmount(); }
  expect(first.getState()).toBeNull();
  expect(second.getState()).toBeNull();
});
