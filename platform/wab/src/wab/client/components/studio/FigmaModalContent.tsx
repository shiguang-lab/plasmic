import { UiText } from "@/wab/client/i18n/UiText";
import * as React from "react";

export function FigmaModalContent() {
  return (
    <>
      <p>
        <UiText
          message={
            "To import Figma layers into a Plasmic project, first install {part1} plugin on your Figma workspace."
          }
          values={{
            part1: (
              <a
                href="https://www.figma.com/community/plugin/845367649027913572/Figma-to-Code-by-Plasmic"
                target="_blank"
              >
                Figma-to-Code by Plasmic
              </a>
            ),
          }}
        />
      </p>

      <p>
        <UiText
          message={
            "Then, on a Figma file, load the plugin by right-clicking the canvas, hovering into {part1} and clicking {part2}. Select the layers you want to export and click {part3}."
          }
          values={{
            part1: (
              <em>
                <UiText message={"Plugins"} />
              </em>
            ),
            part2: <em>Figma-to-Code by Plasmic</em>,
            part3: (
              <em>
                <UiText message={"Export selected layers to clipboard"} />
              </em>
            ),
          }}
        />
      </p>

      <p>
        <UiText
          message={
            "Finally, paste into a Plasmic artboard by pressing Cmd/Ctrl+V."
          }
        />
      </p>

      <iframe
        width="560"
        height="315"
        src="https://www.youtube.com/embed/dn8gRc3M2NA"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </>
  );
}
