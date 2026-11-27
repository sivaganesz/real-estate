/**
 * The browser ESM build of tesseract.js has no type file of its own; it is the same API as the package root.
 * (The root entry is CommonJS, which the dev server serves untransformed because tesseract.js is excluded from
 * dependency pre-bundling, so the browser build is imported instead.)
 */
declare module 'tesseract.js/dist/tesseract.esm.min.js' {
  const Tesseract: typeof import('tesseract.js')
  export default Tesseract
}
