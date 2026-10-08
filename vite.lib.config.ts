import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], build: { outDir: 'dist-widget', lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'currency-converter-widget', cssFileName: 'currency-converter-widget' }, rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'] } } });
