import { defineConfig, normalizePath } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fullReloadAlways = (paths: string[]) => ({
  name: "full-reload-always",
  configureServer({ watcher, ws }) {
    const watchedPaths = paths.map((p) => normalizePath(resolve(__dirname, p)));

    watchedPaths.forEach((p) => watcher.add(p));

    watcher.on("change", (path: string) => {
      if (watchedPaths.some((p) => path.startsWith(p))) {
        ws.send({ type: "full-reload", path: "*" });
        console.log(`[Full Reload] Change detected in: ${path}`);
      }
    });
  },
});

export default defineConfig({
  root: "./src",
  publicDir: "../public",
  server: {
    port: 3000,
    watch: {
      ignored: ["!**/ui/**"],
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  plugins: [
    fullReloadAlways(["ui"]),
    viteStaticCopy({
      targets: [
        {
          src: resolve(
            __dirname,
            "node_modules/xmlui/dist/standalone/xmlui-standalone.umd.js",
          ),
          dest: "vendor",
          rename: "xmlui.js",
        },
        { src: resolve(__dirname, "ui/*"), dest: "" },
      ],
    }),
  ],
});
