import { initializeUiLocale } from "@/wab/client/i18n";
import { main } from "@/wab/client/components/Shell";
import { dbg } from "@/wab/shared/dbg";
import "@/wab/styles/antd-overrides.scss";
import "@/wab/styles/loader.scss";
import "@/wab/styles/main.sass";
import * as mobx from "mobx";

mobx.configure({
  enforceActions: "never",
});

dbg.mobx = mobx;

//
// Main application code
//
performance.mark("studio-entry");
void initializeUiLocale().then(main, (error) => {
  console.error("Unable to load UI language", error);
  main();
});
