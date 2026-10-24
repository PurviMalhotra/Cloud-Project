import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const mockAuth = fileURLToPath(new URL('./AuthContext.jsx', import.meta.url));
export default defineConfig({
  plugins: [
    { name: 'report-preview-only', enforce: 'pre',
      resolveId(id) { if (/context\/AuthContext(?:\.jsx)?$/.test(id)) return mockAuth; },
      transformIndexHtml(html) { return html.replace('<body>', '<body><div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#fff1c7;color:#3b2b00;text-align:center;padding:9px;font:14px Arial">LOCAL REPORT PREVIEW — SAMPLE DATA — NO AWS CONNECTION</div>'); },
    },
    react(),
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
