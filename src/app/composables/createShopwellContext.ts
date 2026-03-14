/**
 * Currently devtools are not working in Nuxt 3
 * source: https://github.com/nuxt/framework/issues/4325
 * - we don't need them for now as we do not show any significant info for now
 */

import { effectScope, markRaw, reactive } from "vue";
import type { App, EffectScope } from "vue";

export function createShopwellContext(
  app: App,
) {
  const scope: EffectScope = effectScope(true);
  const state = scope.run(() => {
    return reactive({
      interceptors: {},
    });
  });

  const shopwellPlugin = markRaw({
    install(app: App) {
      shopwellPlugin._a = app;
      app.config.globalProperties.$shopwell = shopwellPlugin;
      app.provide("shopwell", shopwellPlugin);
    },
    _a: app,
    _e: scope,
    state,
  });
  return shopwellPlugin;
}
