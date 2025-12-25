import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      ".csb.app",   // allow all csb.app subdomains
      "localhost",
      "127.0.0.1",
    ],
    host: true,
    port: 5173,
    strictPort: true,
  },
});
