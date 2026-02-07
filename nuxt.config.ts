// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxt/ui'
  ],
  css: [
    'maplibre-gl/dist/maplibre-gl.css'
  ],
  runtimeConfig: {
    // Private keys (only available on server-side)
    janusApiUrl: process.env.NUXT_JANUS_API_URL || 'http://localhost:3001',
    janusApiKey: process.env.NUXT_JANUS_API_KEY,
    // Public keys (exposed to client-side)
    public: {
      mapTileUrl: process.env.NUXT_PUBLIC_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      refreshInterval: process.env.NUXT_PUBLIC_REFRESH_INTERVAL || 5000
    }
  }
})