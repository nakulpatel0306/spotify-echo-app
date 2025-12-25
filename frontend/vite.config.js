import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// vite configuration for development server
export default defineConfig({
  plugins: [react()],
  // configure dev server to bind to localhost on port 5173 (matches spotify redirect uri)
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true // fail if port is already in use instead of trying another port
  }
});
