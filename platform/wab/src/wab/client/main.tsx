import { initializeUiLocale } from "@/wab/client/i18n";
import { main } from "@/wab/client/components/Shell";
import "@/wab/styles/antd-overrides.scss";
import "@/wab/styles/loader.scss";
import "@/wab/styles/main.sass";
//
// Main application code
//
performance.mark("studio-entry");
void initializeUiLocale().then(main, (error) => {
  console.error("Unable to load UI language", error);
  main();
});
