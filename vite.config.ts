import {defineConfig} from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import * as path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [uni()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src")
        }
    },
    server: {
        host: '0.0.0.0',
        hmr: true,
        proxy: {
            '/store-api': {
                target: 'http://127.0.0.1:8083',
                changeOrigin: true,
            }
        }
    }
});
