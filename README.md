# Gedankenraum

Eine erste installierbare Notizen-PWA mit React, Vite und TypeScript. Der aktuelle Prototyp speichert Notizen lokal im Browser und ist damit direkt ohne Backend testbar. Jede Notiz hat einen Titel, optional ein Ablaufdatum und kann in einer Kalenderansicht gefunden werden.

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

Als Build-Ausgabe verwendet Vite den Ordner `dist`. Die App enthält Pages Functions für eine passwortlose D1-Anmeldung: Beim ersten Gerät wird ein Konto erstellt, weitere Geräte werden über einen zehn Minuten gültigen Verbindungscode hinzugefügt. Die Notizen werden serverseitig pro Konto gespeichert.

Die beiden Ansichten **Gedanken** und **Kalender** lassen sich über die untere Navigation oder auf Touch-Geräten per horizontalem Wischen wechseln. Die Kalenderansicht zeigt alle Notizen, für die ein Ablaufdatum gesetzt wurde.

## Cloudflare-D1-Backend einrichten

1. In Cloudflare unter **Storage & databases → D1 → Create database** eine Datenbank mit dem Namen `notizen-pwa` erstellen.
2. Die erzeugte Datenbank-ID in `wrangler.toml` anstelle von `REPLACE_WITH_YOUR_D1_DATABASE_ID` eintragen.
3. Die Migration ausführen:

```bash
npx wrangler d1 migrations apply notizen-pwa --remote
```

4. In den Pages-Projekteinstellungen unter **Settings → Functions → D1 database bindings** die Datenbank als Binding `DB` hinzufügen.

Danach deployen. Beim ersten Besuch erscheint der Dialog zum Erstellen eines Kontos. Im Profil-Icon oben rechts kann ein Verbindungscode für weitere Geräte erzeugt werden.
