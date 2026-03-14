import {createSSRApp} from "vue";
import App from "./App.vue";
import {createShopwellContext} from "@/app/composables/createShopwellContext";
import { apiClient } from "./apiClient";
export function createApp() {
    const app = createSSRApp(App);

    const shopwellContext = createShopwellContext(app);
    app.provide("apiClient", apiClient);
    app.use(shopwellContext);
    return {
        app,
    };
}
