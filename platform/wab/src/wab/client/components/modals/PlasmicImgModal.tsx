import { CodeSnippet } from "@/wab/client/components/coding/CodeDisplay";
import { confirm } from "@/wab/client/components/quick-modals";
import { UiText } from "@/wab/client/i18n/UiText";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { spawnWrapper } from "@/wab/shared/common";
import { notification } from "antd";
import { ok } from "neverthrow";
import React from "react";

export async function showPlasmicImgModal(studioCtx: StudioCtx) {
  const res = await confirm({
    title: <UiText message="Enable automatic image optimization?" />,
    message: (
      <>
        <p>
          <UiText
            message={
              "Automatic image optimization aims to improve performance scores for websites that use Plasmic by:"
            }
          />
          <ul className="disc-list">
            <li>
              <UiText message={"Serving images in next-gen formats;"} />
            </li>
            <li>
              <UiText message={"Resizing images according to their usage;"} />
            </li>
            <li>
              <UiText message={"Lazy loading images by default;"} />
            </li>
            <li>
              <UiText
                message={
                  "Reducing Cumulative Layout Shift (CLS) by preallocating space for the image."
                }
              />
            </li>
          </ul>
        </p>
        <h2>
          <UiText message={"Possible breaking changes"} />
        </h2>
        <p>
          <UiText
            message={
              "We have tried to make sure these optimized images behave and look the same as they once did. But there are some cases where you may need to make some small tweaks:"
            }
          />
          <ul className="disc-list">
            <li>
              <UiText
                message={
                  "Some images may end up with a different size if they were sized in unusual ways. Most of the time, you can fix this by explicitly setting the size you want on the affected image in the studio;"
                }
              />
            </li>
            <li>
              <UiText
                message={
                  "If you are using prop overrides to specify a {part1}, then you should note that that ref may now contain a reference to a wrapper {part2} instead. If you need a reference to the {part3}, please override the {part4} prop instead. If you are using prop overrides to specify a {part5}, note that the CSS class may now be placed on a wrapper div element instead;"
                }
                values={{
                  part1: <code>ref</code>,
                  part2: <code>HTMLDivElement</code>,
                  part3: <code>HTMLImageElement</code>,
                  part4: <code>imgRef</code>,
                  part5: <code>className</code>,
                }}
              />
            </li>
            <li>
              <UiText
                message={
                  'If you want the image to not make use lazy loading, you\'ll need to explicitly set its "{part1}" attribute to "{part2}" in the studio.'
                }
                values={{
                  part1: (
                    <code>
                      <UiText message={"Loading"} />
                    </code>
                  ),
                  part2: (
                    <code>
                      <UiText message="Eager" />
                    </code>
                  ),
                }}
              />
            </li>
          </ul>
        </p>
        <h2>
          <UiText message={"How to enable"} />
        </h2>
        <p>
          <UiText
            message={
              "Click on the confirm button below to enable image optimization for this project."
            }
          />{" "}
          <br /> <br />
          <UiText
            message={
              "For Headless API users, image optimization will be turned on the next time you publish your project."
            }
          />{" "}
          <br /> <br />
          <UiText
            message="For codegen users, automatic image resizing requires Plasmic-served images. Update {property} in {file} to {value}."
            values={{
              property: <code>images.scheme</code>,
              file: <code>plasmic.json</code>,
              value: <code>"cdn"</code>,
            }}
          />
          <CodeSnippet language="json">
            {`"images": {
  "scheme": "cdn"
}`}
          </CodeSnippet>
        </p>
      </>
    ),
  });
  if (res) {
    await studioCtx.change<never>(() => {
      studioCtx.site.flags.usePlasmicImg = true;
      return ok();
    });
    const saveResult = await studioCtx.save();
    if (saveResult === "Success") {
      notification.info({
        message: (
          <UiText message="Successfully enabled image optimization. Reloading the project to render the updated images..." />
        ),
        duration: 5,
      });
      setTimeout(
        spawnWrapper(() => studioCtx.appCtx.api.reloadLocation()),
        5000,
      );
    }
  }
}
