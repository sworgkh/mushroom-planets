# Mushroom Planets

Three tiny mushroom planets you can orbit, poke and replant, drawn in the
browser with [three.js](https://threejs.org). No build step, no dependencies to
install: plain ES modules, three.js pinned from a CDN.

![three planets](docs/three-planets.png)

- **Bioluminescent** — night, glowing cyan rivers, blue and violet mushroom
  houses, spirit orbs, a crescent moon.
- **Purple Morel** — twilight village of honeycomb morel houses with smoking
  chimneys, cobble paths, villagers in knitted sweaters.
- **Golden Chanterelle** — trumpet-shaped golden caps with wavy rims, tall
  chanterelle towers with balconies, a reader on a bench.
- **All three** — the planets together in one view.

## Run

```bash
python3 -m http.server 8477
open http://localhost:8477/
```

Or open `dist/three-planets.html` directly: a single file with the three-planet
view and a settings panel behind the ⚙ button (needs internet for three.js).

## Play

| Do this | Result |
|---|---|
| drag / scroll | orbit and zoom |
| click a house | toggles its window lights |
| click a villager | they stop and say something |
| click a spirit orb | it pops and regrows |
| click the moss | plants a new mushroom |
| `P` `space` `R` `S` `H` | next planet · spin · new seed · save PNG · panel |

Planet and seed live in the URL, e.g. `?planet=morel&seed=morel`.

## Layout

```
index.html              the page: planet switcher, panel, tooltip, clicks
scenes/                 one module per planet (+ trio.js composing all three)
lib/                    renderer, seeded RNG, planet surface, mushrooms, villagers, props, sky, picking
tools/build-single.py   folds everything into dist/three-planets.html
dist/three-planets.html generated single-file build
```

A scene module exports `id`, `label`, `DEFAULTS`, `RANGES`, `LOOK`, `makeSky()`
and `createWorld(params)`; register it in `SCENES` in `index.html` and it shows
up in the dropdown. Everything random goes through the seeded `Rng`, so a seed
always rebuilds the same world.

## License

MIT
