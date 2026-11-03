import { installDesktopNavigation } from "@/wab/client/desktop-navigation";
import { createMemoryHistory } from "history";
import { reportError } from "@/wab/client/ErrorNotifications";
vi.mock("@/wab/client/ErrorNotifications", () => ({ reportError: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
it("keeps ordinary web navigation unchanged", () => {
  const history = createMemoryHistory();
  const push = history.push;
  const dispose = installDesktopNavigation(history);
  history.push("/projects/first");
  expect(history.location.pathname).toBe("/projects/first");
  dispose();expect(history.push).toBe(push);
});
it("hands editor boundaries to Desktop while keeping same-project state and routes", () => {
  const navigate = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("desktopNavigation", {navigate,isActive:()=>true,onActiveChange:()=>()=>{}});
  const history = createMemoryHistory({initialEntries:["/projects/first"]});
  const push = history.push, replace = history.replace;
  const dispose = installDesktopNavigation(history);
  history.push("/projects/first/preview", {tab:2});
  expect(history.location.pathname).toBe("/projects/first/preview");expect(history.location.state).toEqual({tab:2});
  history.replace("/projects/first?arena=Overview");expect(navigate).not.toHaveBeenCalled();
  history.push("/projects");expect(navigate).toHaveBeenCalledWith(new URL("/projects",window.location.href).href);
  expect(history.location.pathname).toBe("/projects/first");
  history.push("/projects/second");expect(navigate).toHaveBeenCalledTimes(2);
  dispose();expect(history.push).toBe(push);expect(history.replace).toBe(replace);
});
it("keeps a failed navigation on the protected editor and reports the failure", async () => {
  const error = new Error("Draft not protected");
  vi.stubGlobal("desktopNavigation", {navigate:vi.fn().mockRejectedValue(error),isActive:()=>true,onActiveChange:()=>()=>{}});
  const history = createMemoryHistory({initialEntries:["/projects/first"]});
  const dispose = installDesktopNavigation(history);
  history.push("/projects");await Promise.resolve();
  expect(history.location.pathname).toBe("/projects/first");expect(reportError).toHaveBeenCalledWith(error);
  dispose();
});
it("keeps dashboard navigation local and delegates entry into an editor", () => {
  const navigate = vi.fn().mockResolvedValue(undefined);vi.stubGlobal("desktopNavigation",{navigate,isActive:()=>true,onActiveChange:()=>()=>{}});
  const history = createMemoryHistory({initialEntries:["/projects"]});const dispose = installDesktopNavigation(history);
  history.push("/workspaces/example");expect(history.location.pathname).toBe("/workspaces/example");expect(navigate).not.toHaveBeenCalled();
  history.push("/projects/first");expect(navigate).toHaveBeenCalledOnce();expect(history.location.pathname).toBe("/workspaces/example");dispose();
});

it("reactivates cached Dashboard routes and refreshes metadata without remounting the same route", () => {
  let activate: (state: {active:boolean;url?:string})=>void = () => undefined;
  const stop = vi.fn();
  vi.stubGlobal("desktopNavigation",{navigate:vi.fn(),isActive:()=>true,onActiveChange:(callback:typeof activate)=>{activate=callback;return stop;}});
  const history=createMemoryHistory({initialEntries:["/projects"]});
  const listen=vi.fn();history.listen(listen);
  const dispose=installDesktopNavigation(history);
  activate({active:false});activate({active:true,url:new URL("/projects",window.location.href).href});
  expect(listen).not.toHaveBeenCalled();
  activate({active:true,url:new URL("/workspaces/first",window.location.href).href});
  expect(history.location.pathname).toBe("/workspaces/first");
  expect(listen).toHaveBeenCalledOnce();dispose();expect(stop).toHaveBeenCalledOnce();
});
