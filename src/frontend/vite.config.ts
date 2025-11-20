import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// @ts-ignore
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    server: {
        port: 5173,
        host: true,
        proxy: {
            "/api": "http://localhost:3000",
            "/health": "http://localhost:3000",
        },
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
    },
});
