/**
 * Platform-neutral code shared by the web PWA (app/frontend) and the
 * React Native app (app/mobile).
 *
 * The rule for this package: no browser APIs, no React Native APIs, no
 * network, no storage. Pure data, pure logic, pure types. Anything that
 * needs a platform primitive (fetch base URL, storage, connectivity)
 * stays in the platform's own lib/ - see the mobile plan's reuse audit.
 *
 * `Intl` is the one platform-ish dependency (money.ts). Hermes ships
 * partial ICU, so app/mobile installs an @formatjs polyfill at startup
 * BEFORE importing this package. On the web it is native.
 */

export * from './money'
export * from './bangla'
export * from './tips'
export * from './types'
