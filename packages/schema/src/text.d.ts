/** Schema and template assets are imported as their raw text via the build loader. */
declare module "*.xsd" {
  const content: string;
  export default content;
}
declare module "*.md" {
  const content: string;
  export default content;
}
