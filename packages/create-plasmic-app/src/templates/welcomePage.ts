export const PLASMIC_LOGO = `function PlasmicLogo() {
  const gradientId = React.useId();
  return (<svg xmlns="http://www.w3.org/2000/svg" width={40} height={40} viewBox="0 0 32 32"><defs><linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="4" y1="3" x2="23" y2="29">
<stop offset="0" stopColor="#39d3df"/>
<stop offset="0.34" stopColor="#4c89ed"/>
<stop offset="0.7" stopColor="#7955d9"/>
<stop offset="1" stopColor="#c46cda"/>
</linearGradient></defs><g fill={"url(#" + gradientId + ")"}><path d="M7 3H21A8 8 0 0 1 21 19H14.48Q14 19 14.300 18.625L17.825 14.219Q18 14 18.28 14H21A3 3 0 0 0 21 8H11Z"/><path d="M11 13H17.52Q18 13 17.700 13.375L14.175 17.781Q14 18 13.72 18H11A3 3 0 0 0 11 24H21L17 29H11A8 8 0 0 1 11 13Z"/></g></svg>);
}
`;

export function WELCOME_PAGE(
  hasPages: boolean,
  platform: string,
  pageSection: string,
): string {
  return `import React from "react";
${hasPages && platform === "nextjs" ? `import Link from "next/link";` : ""}
${PLASMIC_LOGO}

function Index() {
  return (
    <div style={{ width: "100%", padding: "100px", alignContent: "center" }}>
      <header>
        <PlasmicLogo />
        <h1 style={{ margin: 0 }}>
          Welcome to Plasmic!
        </h1>
        <h4>
          <a
            style={{ color: "blue" }}
            href="https://www.plasmic.app/learn/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn Plasmic
          </a>
        </h4>
        ${pageSection}
        <p><i>Note: Remember to remove this file if you introduce a Page component at the &#39;/&#39; path.</i></p>
      </header>
    </div>
  );
}

export default Index;
`;
}
