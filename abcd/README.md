# SeaPulse

A self-contained maritime surveillance & ecosystem command dashboard —
treasure-map themed UI (leather, gold, wax-seal accents), with a built-in
ship simulator, geofence zones, alerts, and analytics. No backend required —
everything runs client-side in the browser.

## Run it in VS Code

1. Open this folder in VS Code (`File → Open Folder…`).
2. Open a terminal in VS Code (`` Ctrl+` ``/`` Cmd+` ``) and run:

   ```bash
   npm install
   npm run dev
   ```

3. Open the URL it prints (usually **http://localhost:5173**) in your browser.

That's it — no Python, no database, no extra setup. Edit `src/SeaPulse.jsx`
and the page hot-reloads automatically.

## Project structure

```
seapulse/
  index.html          # entry HTML
  vite.config.js       # Vite dev/build config
  package.json
  src/
    main.jsx            # mounts <SeaPulseApp />
    SeaPulse.jsx          # the entire app (UI, simulation, charts)
```

## Notes

- Uses `recharts` for charts and `lucide-react` for icons — both installed
  automatically via `npm install`.
- Fonts (Cinzel, Inter, JetBrains Mono) are pulled from Google Fonts via a
  CSS `@import` inside the component, so you'll need an internet connection
  the first time a browser loads them (they're cached after that).
- This version's ship simulator and geofence logic run entirely in the
  browser (an in-memory `setInterval` tick loop) — it isn't wired up to the
  FastAPI/Redis/MongoDB backend from the earlier full-stack build. Say the
  word if you want the two connected (this UI fed by the real pipeline over
  WebSocket instead of its internal simulator).
