import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { StandardMarkdown } from "@/wab/client/utils/StandardMarkdown";
import { MIXINS_CAP, PRIVATE_STYLE_VARIANTS_CAP } from "@/wab/shared/Labels";
import React, { ReactNode } from "react";

export function MixinsTooltip({ preamble }: { preamble?: ReactNode }) {
  return (
    <div>
      <p className={"tooltip-title"}>{<UiLabel text={MIXINS_CAP} />}</p>
      {preamble}
      <p>
        <UiText
          message={
            "Style presets are entire bundles of styles that you can apply to many elements. Normally, you set styles directly on elements, via the Design tab in the right sidebar. You can instead store some or all those styles in a style preset, and then apply the style preset to elements."
          }
        />
      </p>
      <p>
        <UiText
          message={
            "You can right-click styles or style sections to extract them into a style preset."
          }
        />
      </p>
      <p>
        <UiText
          message={
            "Style presets are a powerful way to let you design faster and maintain consistency."
          }
        />
      </p>
      <p>
        <a
          target="_blank"
          href={"https://docs.plasmic.app/learn/style-presets"}
        >
          <UiText message={"Learn more in the docs"} />
        </a>
        .
      </p>
    </div>
  );
}

export function VariantsTooltip({ preamble }: { preamble?: ReactNode }) {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Variants"} />
      </p>
      {preamble}
      <p>
        <UiText
          message={
            "Variants let you design a page or component to look different in different conditions. For instance, a page can have a mobile variant or a French variant. A Button component can have hover/pressed states, or primary/secondary styles."
          }
        />
      </p>
      <p>
        <UiText
          message={
            'Use the on-canvas variant toolbar to toggle recording to any variant. Any edits you make while recording will override the component\'s "Base" (default) appearance. These overrides are indicated by a red colored dot.'
          }
        />
      </p>
      <p>
        <UiText
          message={
            'Screen variants are a special variant group that are based on screen size ("breakpoints") such as desktop vs. mobile.'
          }
        />
      </p>
      <p>
        <a target="_blank" href={"https://docs.plasmic.app/learn/variants"}>
          <UiText message={"Learn more in the docs"} />
        </a>
        .
      </p>
    </div>
  );
}

export function GlobalVariantsTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Global Variants"} />
      </p>
      <p>
        <UiText
          message={
            "If you want to re-theme the entire app, such as adding a dark mode, or a French language translation, you probably want to change many pages/components together."
          }
        />
      </p>
      <p>
        <UiText
          message={
            "Global variants are similar to normal (component/page-specific) variants, except that global variants are global to the entire project: any component can have edits defined under a single \u201cDark mode\u201d variant."
          }
        />
      </p>
      <p>
        <a
          target={"_blank"}
          href={"https://docs.plasmic.app/learn/global-variants/"}
        >
          <UiText message={"Learn more in the docs"} />
        </a>
        .
      </p>
    </div>
  );
}

export function VariantCombosTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Variant Combinations"} />
      </p>
      <p>
        <UiText
          message={
            'This lists all the combinations of variants that this component has recorded edits for. For instance, you might want a Button to have specific style settings when both the "Primary" variant and "Hover" interaction variant are activated.'
          }
        />
      </p>
      <p>
        <a
          target={"_blank"}
          href={
            "https://docs.plasmic.app/learn/variants/#targeting-combinations-of-variants"
          }
        >
          <UiText message={"Learn more in the docs"} />
        </a>
        .
      </p>
    </div>
  );
}

export function MetadataTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Component metadata"} />
      </p>
      <p>
        <UiText
          message={
            'You can specify arbitrary key-value pairs as metadata for this page or component. Note: these are not page "meta tags"--these are arbitrary data for your code to consume from the headless API or in codegen (for any purpose). Learn more in the API docs.'
          }
        />
      </p>
      <p>
        <a
          target={"_blank"}
          href={"https://docs.plasmic.app/learn/page-head-metadata/"}
        >
          <UiText message={"Learn more in the docs"} />
        </a>
        .
      </p>
    </div>
  );
}

export function PropsTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Props"} />
      </p>
      <p>
        <UiText
          message={
            "Props enable you to customize individual instances of a component. Reference props anywhere inside the component with dynamic values."
          }
        />
      </p>
      <p>
        <UiText
          message={
            "Use / in a prop name to organize props into folders, e.g. Header / title."
          }
        />
      </p>
      <p>
        <a target={"_blank"} href={"https://docs.plasmic.app/learn/props"}>
          <UiText message={"Learn more in the docs"} />
        </a>
        .
      </p>
    </div>
  );
}

export function ElementVariantsTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        {<UiLabel text={PRIVATE_STYLE_VARIANTS_CAP} />}
      </p>

      <p>
        <UiText
          message={
            "Element variants let you edit the styles of individual elements in special interactive states, such as hovered, focused, pressed."
          }
        />
      </p>

      <p>
        <a
          href="https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes"
          target="_blank"
        >
          <UiText message="Element variants can also target elements in a more advanced way using CSS pseudo-classes." />
        </a>
      </p>

      <p>
        <UiText
          message={
            "(Component interaction variants are similar, but let you edit anything in the component based on the hover/focused/pressed state of the component's root element.)"
          }
        />
      </p>
    </div>
  );
}

export function ProjectDependenciesTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Project Dependencies"} />
      </p>
      <p>
        <UiText
          message={
            "You can import other Plasmic projects as a dependency. The imported components are labeled as imported components, in the Components tab. Imported components are read-only. In order to edit these components, please visit their home project."
          }
        />
      </p>
    </div>
  );
}

export function AttributesTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Attributes"} />
      </p>
      <p>
        <UiText
          message={
            "Attributes are non-style settings you can set on an element. Examples include hover text, ARIA attributes, and tab order."
          }
        />
      </p>
      <p>
        <UiText
          message={
            "Different types of elements have different attributes. For instance, with text inputs you can set placeholder text, with links you can set the URL, with buttons you can set whether it's disabled, and so on."
          }
        />
      </p>
    </div>
  );
}

export function SlotsTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Slots"} />
      </p>
      <p>
        <UiText
          message={
            "Slots let you fill in different instances of a component with different content."
          }
        />
      </p>
      <p>
        <UiText
          message={
            "Converting an element in a component to a slot target means you want to let component instances override that element."
          }
        />
      </p>
      <p>
        <a target={"_blank"} href={"https://docs.plasmic.app/learn/slots"}>
          <UiText message={"Learn more in the docs"} />
        </a>
        .
      </p>
    </div>
  );
}

export function ApplyMixinsTooltip() {
  return (
    <MixinsTooltip
      preamble={
        <>
          <p>
            <UiText
              message={
                "This is where you can apply style presets to the selected element."
              }
            />
          </p>
          <p>
            <a
              target={"_blank"}
              href={"https://docs.plasmic.app/learn/style-presets"}
            >
              <UiText message={"Learn more in the docs"} />
            </a>
            .
          </p>
        </>
      }
    />
  );
}

export function ApplyCustomBehaviorsTooltip() {
  return (
    <CustomBehaviorsTooltip
      preamble={
        <>
          <p>
            <UiText
              message={
                "This is where you can apply Custom Behaviors to the selected element. Use cases are general and varied. Examples: attach click-tracking to an element, or trigger a complex interaction, or apply an animated effect transform."
              }
            />
          </p>
          <p>
            <UiText
              message={
                "Underlying these are code components that are meant to wrap around an element."
              }
            />
          </p>
          <p>
            <a
              target="_blank"
              href="https://docs.plasmic.app/learn/custom-behaviors"
            >
              <UiText message={"Learn more in the docs"} />
            </a>
            .
          </p>
        </>
      }
    />
  );
}

export function RepeaterPropsTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Repeater Props"} />
      </p>
      <p>
        <UiText
          message={
            "This section shows props for the parent Repeater component. You can use it to customize the elements which are being repeated."
          }
        />
      </p>
    </div>
  );
}

export function PageParamsTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Preview parameters"} />
      </p>
      <p>
        <UiText
          message={
            'This section shows URL parameters defined in page path using brackets (e.g. [param]). In production, such parameters are defined based in the URL, but in studio you can customize what preview value they should have. For example, if your page path is /products/[slug] you can see how the page looks like and customize its styles using different "slug" values.'
          }
        />
      </p>
    </div>
  );
}

export function PageQueryParamsTooltip() {
  return (
    <div style={{ paddingBottom: 10 }}>
      <p className={"tooltip-title"}>
        <UiText message={"URL Parameters"} />
      </p>
      <p>
        <UiText
          message={
            "Add a path parameter like /item/ [id] to accept URLs like abc.com/item/ 235."
          }
        />
      </p>
      <p>
        <UiText
          message={
            "Add a URL query parameter to accept URLs like abc.com/item/235? coupon=summer10."
          }
        />
      </p>
      <p>
        <UiText
          message={
            "Here you can also set the current preview values for these parameters."
          }
        />
      </p>
      <p>
        <a
          target={"_blank"}
          href="https://docs.plasmic.app/learn/dynamic-pages"
        >
          <UiText message={"Learn more in the docs"} />
        </a>
        .
      </p>
    </div>
  );
}

export function ServerQueriesTooltip() {
  return (
    <div style={{ paddingBottom: 10 }}>
      <p>
        <UiText
          message={
            "Add data queries to get data from a data source such as an API or CMS."
          }
        />
      </p>
      <p>
        <a target={"_blank"} href="https://docs.plasmic.app/learn/data-queries">
          <UiText message={"Learn more in the docs"} />
        </a>
        .
      </p>
    </div>
  );
}

export function DataQueriesDeprecatedTooltip(props: { showMigrate?: boolean }) {
  return (
    <div style={{ paddingBottom: 10 }}>
      <p>
        <UiText
          message={
            "Legacy data queries ($queries) are deprecated. Please use the new data queries ($q) in the section above."
          }
        />
      </p>
      {props.showMigrate && (
        <p>
          <UiText
            message={
              "Use the Migrate all button, or Migrate in an individual query's menu, to convert to new data queries with Plasmic AI."
            }
          />
        </p>
      )}
      <p>
        <a
          target={"_blank"}
          href="https://docs.plasmic.app/learn/integrations-migration-guide"
        >
          <UiText message={"Learn more in the migration guide"} />
        </a>
        .
      </p>
    </div>
  );
}

export function DataQueriesTooltip() {
  return (
    <div style={{ paddingBottom: 10 }}>
      <p>
        <UiText
          message={
            "Add data queries to get data from an integration like a backend database or API."
          }
        />
      </p>
      <p>
        <a
          target={"_blank"}
          href="https://docs.plasmic.app/learn/integrations#data-queries"
        >
          <UiText message={"Learn more in the docs"} />
        </a>
        .
      </p>
    </div>
  );
}

export function StateVariablesTooltip() {
  return (
    <div style={{ paddingBottom: 10 }}>
      <p>
        <UiText
          message={
            "Create state variables to store any data that can change in your UI over time or as the user interacts. Update these from interactions, and connect your UI to them with dynamic values."
          }
        />
      </p>
      <p>
        <UiText
          message={
            "For instance, add a counter number variable that increments every time the user clicks a button. Set an element's text dynamic value to display the current counter."
          }
        />
      </p>
      <p>
        <a
          target={"_blank"}
          href="https://docs.plasmic.app/learn/interactions/"
        >
          <UiText message={"Learn more in the docs"} />
        </a>
        .
      </p>
    </div>
  );
}

export function InstanceVariantsTooltip() {
  return (
    <VariantsTooltip
      preamble={
        <p>
          <UiText
            message={
              "This is where you can select what variant(s) to show on the selected component instance."
            }
          />
        </p>
      }
    />
  );
}

export function ModeTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Mode"} />
      </p>
      <p>
        <UiText
          message={
            "You can choose to use either the Loader or Codegen paths. The Loader path is only available for Next.js and Gatsby-based builds, and can greatly simplify deployments for most use cases. For all other React stacks, for users who want advanced customizability, and to be able to check Plasmic-generated code into your repository, choose the Codegen path."
          }
        />
      </p>
      <p>
        <UiText
          message={"(Loader is not available for existing repositories)"}
        />
      </p>
    </div>
  );
}

export function DefaultActionTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Default action"} />
      </p>
      <p>
        <UiText
          message={
            "When you push a Plasmic project to a GitHub repository, you can choose whether to make a pull request with the updated code generated by Plasmic or directly commit that code. This option sets the default behavior, but it can be overridden per push."
          }
        />
      </p>
    </div>
  );
}

export function CustomBehaviorsTooltip({ preamble }: { preamble?: ReactNode }) {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Custom behaviors"} />
      </p>
      {preamble}
    </div>
  );
}

export function LeftImagesSectionTooltip({
  preamble,
}: {
  preamble?: ReactNode;
}) {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Images"} />
      </p>
      {preamble}
      <p>
        <UiText
          message={
            "Images are any PNGs, JPGs, or non-colorable SVGs that you can use throughout your designs as pictures or background images."
          }
        />
      </p>
    </div>
  );
}

export function LeftIconsSectionTooltip({
  preamble,
}: {
  preamble?: ReactNode;
}) {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Icons"} />
      </p>
      {preamble}
      <p>
        <UiText
          message={
            "Icons are colorable (but monochrome) SVGs that you can use throughout your designs."
          }
        />
      </p>
    </div>
  );
}

export function AuthProviderTooltip() {
  return (
    <div>
      <StandardMarkdown>
        {`
Plasmic Auth lets users sign up and sign in using Plasmic's integrated auth system.
This is the simplest option.

You can also use a third-party auth provider by switching to Custom Auth (requires code integration).
Examples: Auth0, Supabase Auth, Xano.

[Learn more in the docs](https://docs.plasmic.app/learn/auth).
`}
      </StandardMarkdown>
    </div>
  );
}

export function UserDirectoryTooltip() {
  return (
    <div>
      <p>
        <UiText
          message={
            "User directories are lists of users and user groups. These are reused across projects in your organization or workspace."
          }
        />
      </p>
      <p>
        <a target={"_blank"} href={"https://docs.plasmic.app/learn/auth"}>
          <UiText message={"Learn more in the docs"} />
        </a>
        .
      </p>
    </div>
  );
}

export function RolesTooltip() {
  return (
    <StandardMarkdown>
      {`
Here you define the roles that you can assign users/groups to (in the Permissions tab).

Then, throughout your application, you can set the required role on queries, pages, and components. For instance, only admins should be able to update all records, or only logged-in users can access a page.

Roles are ordered--higher roles can do anything lower roles can do.

[Learn more in the docs](https://docs.plasmic.app/learn/auth).
`}
    </StandardMarkdown>
  );
}

export function DefaultRoleTooltip() {
  return (
    <StandardMarkdown>
      {`
Set the default minimum required role for all new pages.

**Changing this does not affecting existing pages**.

[Learn more in the docs](https://docs.plasmic.app/learn/auth).
`}
    </StandardMarkdown>
  );
}

export function AuthRedirectsTooltip() {
  return (
    <StandardMarkdown>
      {`
This lists allowed URLs to redirect the user to after successful login with Plasmic Auth.

Only needed if you are not using Plasmic Hosting and are using codebase integration. This affects what you can pass to the \`authRedirectUri\` prop in \`PlasmicRootProvider\`.

[Learn more in the docs](https://docs.plasmic.app/learn/auth-integration).
            `}
    </StandardMarkdown>
  );
}

export function AuthTokenTooltip() {
  return (
    <StandardMarkdown>
      {`
If using Custom Auth, this is the secret token to integrate with your codebase.

Pass this into \`ensurePlasmicAppUser()\` to get a user token, and thus be able to run integration queries/operations as that user.

[Learn more in the docs](https://docs.plasmic.app/learn/auth-integration).
`}
    </StandardMarkdown>
  );
}

export function StylePreviewTooltip() {
  return (
    <div>
      <p className={"tooltip-title"}>
        <UiText message={"Preview"} />
      </p>
      <p>
        <UiText
          message={
            "This is how text will look on your site. Styles you define layer on top of the base default styles and Plasmic's CSS resets, just like on your published pages; anything you leave unset falls back to those. Click the preview text to edit."
          }
        />
      </p>
    </div>
  );
}
