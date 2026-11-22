export function getRealClassNames(className: string) {
  return className.split(/\s+/).filter(Boolean);
}
