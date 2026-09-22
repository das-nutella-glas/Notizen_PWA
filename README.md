# Gedankenraum

Eine erste installierbare Notizen-PWA mit React, Vite und TypeScript. Der aktuelle Prototyp speichert Notizen lokal im Browser und ist damit direkt ohne Backend testbar.

## Lokal starten

Node.js installieren und anschließend im Projektordner ausführen:

```bash
npm install
npm run dev
```

Für den Cloudflare-Pages-Build:

```bash
npm run build
```

Als Build-Ausgabe verwendet Vite den Ordner `dist`. Die D1-Synchronisierung und Cloudflare-Access-Anbindung werden in einem nächsten Schritt ergänzt.
