// Type shims for dependencies that ship no declarations.

// remark-collapse has no published types or @types package.
declare module 'remark-collapse' {
  const remarkCollapse: any;
  export default remarkCollapse;
}
