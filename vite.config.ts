import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 700, // warn above ~700KB after minify (tune as needed)
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Group major vendors to reduce a single huge chunk
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("scheduler") || id.includes("wouter")) return "vendor-react";
            if (id.includes("@tanstack")) return "vendor-query";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("@radix-ui")) return "vendor-radix";
            if (id.includes("uppy")) return "vendor-uppy";
            if (id.includes("framer-motion")) return "vendor-motion";
            if (id.includes("date-fns")) return "vendor-date";
            return "vendor"; // rest of node_modules
          }
          // Split some large app areas by route folder names if any
          if (id.includes(path.posix.join("client","src","pages"))) {
            if (id.includes("music-page.tsx")) return "page-music";
            if (id.includes("games-page.tsx")) return "page-games";
            if (id.includes("chat-page.tsx")) return "page-chat";
          }
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
