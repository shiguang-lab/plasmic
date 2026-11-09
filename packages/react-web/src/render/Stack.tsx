import * as React from "react";
import { wrapFlexContainerChildren } from "./elements";

function stackProps(props: { children?: React.ReactNode }, hasGap: boolean | undefined) {
  const {children, ...rest} = props;
  const wrapped = wrapFlexContainerChildren(children, hasGap ?? false);
  return {...rest, ...(wrapped ? {children: wrapped} : {})};
}

function FlexStack<T extends keyof React.JSX.IntrinsicElements = "div">(
  props: { as?: T; hasGap?: boolean } & React.ComponentProps<T>
) {
  const {as, hasGap, ...rest} = props;
  const Element: React.ElementType = as ?? "div";
  return <Element {...stackProps(rest, hasGap) as any} />;
}

function StackDiv(props: React.ComponentProps<"div"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <div {...stackProps(rest, hasGap)} />;
}

function StackA(props: React.ComponentProps<"a"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <a {...stackProps(rest, hasGap)} />;
}

function StackButton(props: React.ComponentProps<"button"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <button {...stackProps(rest, hasGap)} />;
}

function StackH1(props: React.ComponentProps<"h1"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <h1 {...stackProps(rest, hasGap)} />;
}

function StackH2(props: React.ComponentProps<"h2"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <h2 {...stackProps(rest, hasGap)} />;
}

function StackH3(props: React.ComponentProps<"h3"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <h3 {...stackProps(rest, hasGap)} />;
}

function StackH4(props: React.ComponentProps<"h4"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <h4 {...stackProps(rest, hasGap)} />;
}

function StackH5(props: React.ComponentProps<"h5"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <h5 {...stackProps(rest, hasGap)} />;
}

function StackH6(props: React.ComponentProps<"h6"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <h6 {...stackProps(rest, hasGap)} />;
}

function StackLabel(props: React.ComponentProps<"label"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <label {...stackProps(rest, hasGap)} />;
}

function StackForm(props: React.ComponentProps<"form"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <form {...stackProps(rest, hasGap)} />;
}

function StackSection(props: React.ComponentProps<"section"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <section {...stackProps(rest, hasGap)} />;
}

function StackHead(props: React.ComponentProps<"head"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <head {...stackProps(rest, hasGap)} />;
}

function StackMain(props: React.ComponentProps<"main"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <main {...stackProps(rest, hasGap)} />;
}

function StackNav(props: React.ComponentProps<"nav"> & {hasGap?: boolean}) {
  const {hasGap, ...rest} = props;
  return <nav {...stackProps(rest, hasGap)} />;
}

export const Stack = Object.assign(FlexStack, {
  div: StackDiv,
  a: StackA,
  button: StackButton,
  h1: StackH1,
  h2: StackH2,
  h3: StackH3,
  h4: StackH4,
  h5: StackH5,
  h6: StackH6,
  label: StackLabel,
  form: StackForm,
  section: StackSection,
  head: StackHead,
  main: StackMain,
  nav: StackNav,
});
