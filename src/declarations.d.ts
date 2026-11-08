// Allow TypeScript to accept CSS file imports as side-effect modules.
// Vite handles the actual transformation at build time.
declare module '*.css' {}

// Vite's ?raw import: the file's text, bundled at build time.
declare module '*.md?raw' {
  const text: string
  export default text
}
