import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// Read .env file to get API key
let weatherAPIKey = '63d741f83d334782a6332945252810'; // fallback
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/VITE_WEATHERAPI_KEY=(\S+)/);
  if (match) weatherAPIKey = match[1];
} catch (e) {
  console.warn('Could not read .env file, using fallback API key');
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/weather': {
        target: 'https://api.weatherapi.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/weather/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Add API key to request
            const url = new URL(proxyReq.path, options.target);
            url.searchParams.set('key', weatherAPIKey);
            proxyReq.path = url.pathname + url.search;
          });
        }
      }
    }
  }
})
