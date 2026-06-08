/**
 * The `xapi-youtube` package (github:hanieas/xapi-youtube) ships plain
 * browser scripts that attach to `window.ADL`, not typed ES modules. We
 * import them for their side effects (the xAPI Video Profile vocabulary and
 * the YouTube statement engine); these stubs satisfy the type checker.
 *
 * See `services/videoXapi.ts` for how the attached globals are consumed.
 */
declare module 'xapi-youtube/videoprofile';
declare module 'xapi-youtube';
