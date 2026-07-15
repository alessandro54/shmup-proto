import { defineConfig } from 'vite'

// --host is set in the npm script, so the dev server binds to 0.0.0.0
// and is reachable from your phone on the same LAN.
export default defineConfig({
  server: {
    host: true, // expose on local network
    port: 5173,
    allowedHosts: ['proto.chumpitaz.dev', '.trycloudflare.com'], // allow tunnel URLs
  },
})
