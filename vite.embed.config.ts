import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

// Second build into the same dist/: a single ES module exporting mount(), for hosts that
// load the editor at runtime (src/embed.tsx). Runs after the app build, so keep its output.
export default defineConfig((env) =>
  mergeConfig(base(env), {
    publicDir: false,
    // lib mode leaves process.env alone, but React needs it resolved.
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      emptyOutDir: false,
      lib: {
        entry: "src/embed.tsx",
        formats: ["es"],
        fileName: "embed",
        cssFileName: "embed",
      },
      // design-react-kit lazy-loads its icons; keep those chunks out of the dist root.
      rolldownOptions: {
        output: { chunkFileNames: "embed-chunks/[name]-[hash].js" },
      },
    },
  }),
);
