# SeaPulse— Maritime Surveillance Dashboard

A front-end-only, mock-data maritime surveillance command center. No build step,
no server — open `index.html` in a browser and it runs.

## Project structure

```
tidewatch/
├── index.html            Markup + tags that wire everything together
├── css/
│   └── styles.css        All styling (theme tokens, layout, components)
└── js/
    ├── config.js         Static config: nav icons/labels, mock data pools
    │                     (countries, ship names), flag definitions, CENTER coord
    ├── state.js           App state: ships/alerts arrays, history buffers,
    │                      rand/pick helpers, makeShip/initShips, riskColor/
    │                      riskLabel, addAlert
    ├── maps.js            Leaflet setup for all 3 map instances, geofence
    │                      zones, vessel marker rendering, click-to-add geofence
    ├── simulation.js      The tick loop: moves ships, evaluates risk,
    │                      raises flags/alerts
    ├── kpi.js             Builds + refreshes the KPI cards row
    ├── alerts-ui.js       Renders alert rows (dashboard feed + full alert center)
    ├── table.js           Ship monitoring table (render + search filter)
    ├── riskcenter.js      AI Risk Center gauge + flag breakdown
    ├── shippanel.js       Slide-in vessel detail panel
    ├── charts.js          All Chart.js analytics charts
    ├── footer.js          Footer status bar + live clock
    ├── nav.js             Sidebar navigation (builds items, page switching)
    ├── controls.js        Simulation control buttons + settings toggles
    └── main.js            Entry point — boots everything once all modules
                            are loaded (must load last)
```

## Load order matters

These are plain scripts (no bundler, no ES modules) so they share one global
scope, in the order listed in `index.html`:

`config → state → maps → simulation → kpi → alerts-ui → table → riskcenter
→ shippanel → charts → footer → nav → controls → main`

A few files run code immediately at load time and depend on an earlier file
already having defined things:
- `charts.js` and `kpi.js` read from `config.js` (icons, `COUNTRIES`) as soon
  as they load, and `charts.js` needs the Chart.js CDN script loaded first.
- `nav.js` builds the sidebar immediately using `NAV`/`icons` from `config.js`.
- `main.js` calls functions from nearly every other file, so it must be last.

If you add a new file, either append it before `main.js`, or wrap its
top-level code in a function and call that function from `main.js` instead.

## External dependencies (loaded via CDN, no install needed)

- [Leaflet](https://leafletjs.com/) — maps
- [Chart.js](https://www.chartjs.org/) — analytics charts
- Google Fonts: Pirata One, Cinzel, IM Fell English, Special Elite

## Data

Everything is simulated client-side (`simulation.js` + `main.js`'s
`setInterval(tick, 1200)`). There is no backend — swap the simulation tick
for a WebSocket handler if you want to wire in real AIS data.
