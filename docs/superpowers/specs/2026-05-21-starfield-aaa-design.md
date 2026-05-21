# Starfield AAA Upgrade — Design

**Date:** 2026-05-21
**Scope:** Upgrade the existing starfield (`2026-05-20-static-starfield-design.md`) to AAA visual quality through five additions — color-temperature variety, bloom halos on the brightest stars, diffraction spikes on the very brightest stars, per-star twinkle speed + curve variety, and a slow parallax near-layer. Plus a small star-count bump and an amplitude/visibility fix to the existing twinkle (which is implemented but not perceptible in practice).

---

## Goal

Today's starfield (1500 stars, uniform color `#cfd9ff`, size + brightness variation, 12% twinkle with shared sine pulse) reads as "stars present." The user wants it to read as "living deep-space backdrop" — variety across multiple attributes, a few cinematic standout stars, perceptible motion in the sky without competing with foreground.

Three intents drive every parameter:

1. **AAA feel, not AAA cost.** Every effect lives in shaders on a single (or split) `Points` mesh. No postprocessing, no bloom render pipeline, no texture lookups. Added work is gated per-star so the cheap 95% stay cheap.
2. **Visible motion.** Current twinkle is mathematically present but visually undetectable. The pulse must be obvious enough that the sky reads as "alive" without being noisy.
3. **Quiet in aggregate.** Bright accents (spike stars, halo stars) are rare. The mean star is still a tiny soft point that the eye registers once and ignores.

## Non-goals

- No nebula / Milky-Way wash (deferred — user did not select).
- No galactic-plane density clustering (deferred — user did not select).
- No postprocessing pass (bloom is faked in-shader on point sprites).
- No domain state, no events, no port surface, no URL state. Starfield remains background chrome.
- No reactivity to scene FSM state.
- No user-tunable controls.

## Delta from current starfield

This spec is purely additive on top of the existing one. The structural decisions (camera-anchored group, `services/renderer/` + `components/Scene/` split, pure spec builder, pure material factory, single-uniform time tick, no `useEffect`) are unchanged. What changes:

| Aspect | Before | After |
|---|---|---|
| Total stars | 1500 | 2200 (1700 far + 500 near) |
| Draw calls | 1 | 2 (one per layer) |
| Layer count | 1 (camera-locked) | 2 (camera-locked far + parallax near) |
| Color | Single uniform `#cfd9ff` | Per-star color attribute, 6-tint distribution |
| Halo / bloom | None | In-shader, gated by per-star `aLuminous`, top ~5% only |
| Diffraction spikes | None | In-shader, gated by `aLuminous > 0.7`, top ~1.5% only |
| Twinkle fraction | 12% | 14% |
| Twinkle speed | Uniform `1.6` rad/s for all twinklers | Per-star, range `0.4..2.5` rad/s |
| Twinkle curve | Sine only | Sine (~70%) + sharp-blink (~30%) |
| Twinkle amplitude | `0.15..0.35` | `0.35..0.65` (smooth) / `0.50..0.85` (sharp); biased toward brighter stars; luminous tier capped at `0.25` |
| Per-frame uniform tick | `uTime += delta` | Unchanged |

---

## Architecture

### Layer placement

No new files. Three edits, plus per-existing-file new tests:

```
features/scene/
├── components/Scene/
│   └── Starfield.tsx                       EDIT — two <points> groups
└── services/renderer/
    ├── starfieldSpec.ts                    EDIT — extend spec with new attributes
    ├── starfieldSpec.test.ts               EDIT — new assertions
    ├── starfieldMaterial.ts                EDIT — extend shader + uniforms
    └── starfieldMaterial.test.ts           EDIT — new assertions
```

### Layer responsibilities

| File | Responsibility | Forbidden |
|---|---|---|
| `starfieldSpec.ts` | Pure. Given seed + count + radius + layer-tag, produce typed `Float32Array`s for position, size, brightness, color, luminous, twinkleAmp, twinkleSpeed, twinkleSharp, twinklePhase. | three.js, React, side effects. |
| `starfieldMaterial.ts` | Pure factory. Returns a configured `ShaderMaterial` with the new attributes wired and the halo/spike fragment branches gated by `aLuminous`. | RNG, geometry, counts. |
| `Starfield.tsx` | Compose two layers. Build far spec + near spec, build a single shared `ShaderMaterial`. Render two `<points>` groups inside two `<group>` wrappers. `useFrame` ticks `uTime`, copies camera position to far group fully and to near group at `PARALLAX_FACTOR_NEAR`. | Domain logic, conditional rendering by scene state, props from caller. |

The cross-layer rule is preserved: spec returns plain arrays, material returns a configured material, component composes both, scene mounts component.

### Material sharing

A single `ShaderMaterial` instance handles both layers. Per-star variation (color, luminous, twinkle) is entirely attribute-driven, and there are no layer-specific shader paths — far and near stars run identical shader code. One material avoids redundant shader compilation and uniform updates and keeps the existing single-material file shape. `uTime` ticks once per frame on the shared material and both layers see the same time value.

---

## Layers + parallax

Two `Points` meshes inside two camera-following `Group`s, both at `renderOrder = -1`:

| Layer | Count | Sphere radius | Camera follow | Effect |
|---|---|---|---|---|
| Far | 1700 | 400 (unchanged) | 1.0 (locked, current behavior) | Infinity backdrop. |
| Near | 500 | 180 | 0.6 (drifts at 0.4× camera motion) | Foreground stars visibly slide as the ship flies. |

Parallax implementation: in `useFrame`, for the near group set `nearGroup.position.copy(camera.position).multiplyScalar(0.6)`. Because near-layer points live in a fixed-world sphere whose centre is dragged at 0.6× camera velocity, the apparent angular motion is `0.4× camera_speed / radius` — perceptible during ship motion, invisible at rest.

Both layers reuse the same `STAR_SEED` family (different sub-seeds: `STAR_SEED` for far, `STAR_SEED ^ 0xa1b2c3` for near) so HMR and reloads remain deterministic.

Total verts: 2200. Total draw calls: 2. Memory: ~106 KB attribute payload. Cost delta vs current: trivial.

---

## Per-star attribute payload

Spec output extends to:

```ts
type StarfieldSpec = {
  readonly kind: 'starfield_spec';
  readonly count: number;
  readonly positions: Float32Array;       // count * 3
  readonly sizes: Float32Array;           // count
  readonly brightness: Float32Array;      // count
  readonly colors: Float32Array;          // count * 3  (NEW — per-star tint)
  readonly luminous: Float32Array;        // count      (NEW — 0..1, gates halo/spike)
  readonly twinkleAmps: Float32Array;     // count      (existing semantics, new ranges)
  readonly twinkleSpeeds: Float32Array;   // count      (NEW — per-star rad/s)
  readonly twinkleSharps: Float32Array;   // count      (NEW — 0=sine, 1=sharp-blink)
  readonly twinklePhases: Float32Array;   // count
};
```

`buildStarfieldSpec` signature gains an explicit `layer: 'far' | 'near'` field (discriminated union, Iron Law 2) so the builder can apply layer-specific tweaks (e.g., near layer biased slightly larger to compensate for closer radius).

```ts
type StarfieldSpecParams =
  | { readonly layer: 'far'; readonly seed: number; readonly count: number; readonly radius: number }
  | { readonly layer: 'near'; readonly seed: number; readonly count: number; readonly radius: number };
```

The far and near variants currently differ only in numeric parameters, but the tagged union keeps "which layer am I building?" an explicit, type-checked choice rather than a positional convention.

---

## Feature 1 — Color temperature

Per-star color sampled from a fixed weighted palette at spec-build time:

| Tint | Hex anchor | RGB approx | Share |
|---|---|---|---|
| Cool blue-white | `#bcd0ff` | (0.74, 0.82, 1.00) | 15% |
| Neutral white   | `#eef2ff` | (0.93, 0.95, 1.00) | 40% |
| Warm white      | `#fff4dc` | (1.00, 0.96, 0.86) | 25% |
| Orange          | `#ffc89a` | (1.00, 0.78, 0.60) | 12% |
| Deep red-orange | `#ff9272` | (1.00, 0.57, 0.45) | 5%  |
| Hot blue        | `#a0b8ff` | (0.63, 0.72, 1.00) | 3%  |

Distribution is uncorrelated with size *except* for two biases:

- **Top-luminous tier** (`aLuminous > 0`, the brightest ~5%): re-weighted palette where `Hot blue` and `Deep red-orange` shares are tripled and `Neutral white` / `Warm white` are halved. Real bright stars cluster at hot blue (O/B class) and red supergiants — the bias matches stellar reality and gives the cinematic accents.
- **Dimmest 30%** (bottom of the brightness distribution): re-weighted palette where `Neutral white` and `Warm white` are doubled and `Hot blue` / `Deep red-orange` are zeroed. Keeps the dim majority visually quiet.

The middle ~65% use the unbiased palette weights as listed in the table above.

Shader change: vertex pulls `aColor`, passes through as `varying vec3 vColor`. Fragment outputs `vec4(vColor * uColor, vAlpha * core)`. The existing `uColor` uniform stays as a global tint knob (default `vec3(1.0)`) but can be lowered to mute the whole field without rebuilding the spec.

---

## Feature 2 + 3 — Bloom halos + diffraction spikes

Both effects use the same per-star `aLuminous` attribute (0..1) and live in the same point sprite — no second draw call, no postprocess pass.

### Luminous tier assignment

At spec-build time, the top 5% of stars by brightness get `aLuminous > 0`:

- Brightness percentile ≥ 95: `aLuminous` linearly mapped from `0.0` (at the 95th percentile) to `1.0` (the brightest).
- Below 95th percentile: `aLuminous = 0`.

Top ~1.5% (those with `aLuminous > 0.7`) additionally get the diffraction spike branch.

### Point-size enlargement

Vertex shader:

```glsl
float baseSize = aSize * uPixelRatio;
float haloBoost = aLuminous * uHaloSizeBoost;   // luminous stars get a bigger sprite
gl_PointSize = baseSize + haloBoost;
```

With `uHaloSizeBoost ≈ 14.0`, the brightest stars draw at ~17px sprites instead of ~3px. Enough room for the halo falloff and spike length to exist.

### Fragment shader — halo + spike

```glsl
uniform vec3 uColor;
uniform float uHaloStrength;
uniform float uSpikeStrength;

varying float vAlpha;
varying vec3 vColor;
varying float vLuminous;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;

  // Core (existing behaviour)
  float core = smoothstep(0.25, 0.0, r2);

  // Halo — only luminous stars
  // r ranges 0..0.5; halo falls off across that range with soft outer fade.
  float r = sqrt(r2);
  float halo = vLuminous > 0.0
    ? uHaloStrength * vLuminous * smoothstep(0.5, 0.0, r) * smoothstep(0.0, 0.05, r)
    : 0.0;

  // Diffraction spike — only the very brightest
  // Procedural 4-point cross via min(|x|,|y|). Length scales with vLuminous.
  float spikeMask = step(0.7, vLuminous);
  float spikeFalloff = smoothstep(0.5, 0.0, r);
  float spikeArm = max(
    smoothstep(0.04, 0.0, abs(d.y)) * smoothstep(0.5, 0.0, abs(d.x)),
    smoothstep(0.04, 0.0, abs(d.x)) * smoothstep(0.5, 0.0, abs(d.y))
  );
  float spike = spikeMask * uSpikeStrength * (vLuminous - 0.7) / 0.3 * spikeArm * spikeFalloff;

  float intensity = core + halo + spike;
  gl_FragColor = vec4(uColor * vColor, vAlpha * intensity);
}
```

Cost: every fragment runs the halo/spike math, but for non-luminous stars (`vLuminous = 0.0`) both `halo` and `spike` collapse to zero through multiplication. The branch `vLuminous > 0.0` in the halo line is the cheap "skip the smoothstep pair" gate; the spike branch uses `step()` for branchless masking. Because non-luminous points are tiny (a few pixels), even if every ALU op ran every fragment the total cost is negligible.

New uniforms:
- `uHaloSizeBoost` (vertex) — pixel boost for luminous sprites. Default `14.0`.
- `uHaloStrength` (fragment) — halo brightness multiplier. Default `0.55`.
- `uSpikeStrength` (fragment) — spike brightness multiplier. Default `0.45`.

These let us tune visual punch without recompiling.

---

## Feature 4 — Twinkle variety + visibility fix

### Why the current twinkle is invisible

Three compounding causes:

1. **Amplitude too low.** Cap is `0.35`, so a twinkler dims at most from `1.0` to `0.65`. A 35% dim on a 2-pixel sprite over a 3.9-second period is below the perceptual threshold for most viewers.
2. **Uniform speed.** All twinklers share `uTwinkleSpeed = 1.6` rad/s. With a global phase, the eye sees no rhythm — the sky pulses as a smeared average, not as individual stars.
3. **Pure sine.** A sine spends most of its cycle near max. The "dip" is brief and gentle. Reads as "slightly less bright" not "blinking."

### Fix

- **Fraction:** `0.12 → 0.14` (in the 10-15% window the user requested).
- **Per-star speed.** New attribute `aTwinkleSpeed` in `[0.4, 2.5]` rad/s sampled per twinkler. Slow throbs and quick flickers coexist; the eye picks up rhythm from the variance.
- **Per-star curve.** New attribute `aTwinkleSharp ∈ {0, 1}`:
  - `0` (70% of twinklers): smooth sine. Amplitude `0.35..0.65`. Reads as "breathing."
  - `1` (30% of twinklers): sharp blink curve `pow(0.5 + 0.5*sin(...), 6.0)`. Most of the cycle near max, brief dim periods. Amplitude `0.50..0.85`. Reads as "flickering."
- **Brightness bias.** Twinkler selection is preferentially drawn from the brighter end of the population. A bright star losing 60% of intensity is far more visible than a dim star doing the same. Implementation: each star already has an underlying uniform draw `u ∈ [0, 1]` used to shape its size (`size = mix(min, max, u^3)`); because brightness is a monotone function of size, `u` *is* the brightness rank in the population. Then `pBase = TWINKLE_FRACTION * (1 + TWINKLE_BRIGHTNESS_BIAS * (u - 0.5))`. With `TWINKLE_BRIGHTNESS_BIAS = 1.0`, the dimmest star has 7% twinkle probability and the brightest has 21%, averaging exactly to the target 14%.
- **Luminous tier cap.** Stars with `aLuminous > 0` cap `aTwinkleAmp ≤ 0.25` regardless of curve. The cinematic standouts should feel rock-steady, not blink.

Vertex shader twinkle math becomes:

```glsl
float wave = sin(uTime * aTwinkleSpeed + aTwinklePhase);
float normalized = 0.5 + 0.5 * wave;           // 0..1
float sharpened = pow(normalized, 6.0);        // peaky at top, brief dips
float shaped = mix(normalized, sharpened, aTwinkleSharp);
float twinkle = 1.0 - aTwinkleAmp + aTwinkleAmp * shaped;
vAlpha = aBrightness * twinkle;
```

For non-twinklers (`aTwinkleAmp = 0`), `twinkle` collapses to `1.0`. No branching.

---

## Feature 5 — Parallax near layer

Covered in the *Layers + parallax* section above. The key constraints:

- Near layer's sphere radius must stay inside the camera's `far = 500` frustum even after camera motion. With radius `180` and parallax factor `0.6`, the worst-case point distance to camera = `180 + camera_speed * (1 - 0.6) * Δt`. At reasonable camera speeds and small frame deltas the worst-case distance stays well under 500.
- Near layer must not poke through planets / ships. Planets and ships sit at world-space positions; the near-layer sphere center drifts with the camera at `0.6×`. Points sit 180 units from the drifted center, so their world positions can in principle intersect mid-scene geometry as the camera moves. Mitigation: near-layer points use `renderOrder = -1` and `depthWrite: false` (same as today's far layer), and `depthTest: true` means a planet correctly occludes a star behind it. The depth comparison uses each point's actual world-space depth.
- Near-layer stars are visually equivalent to far stars (same shader, same attribute schema). They just sit at a smaller radius and drift, which produces the parallax cue.

---

## Spec generation details

### RNG

Same mulberry32 as today. Far and near layers use distinct seeds (`STAR_SEED` and `STAR_SEED ^ 0xa1b2c3`) so they produce different but deterministic distributions.

### Color sampling

Convert the palette to a cumulative-weight array, draw `u = rng()` per star, find the bucket. Bias logic (top-luminous toward extremes, bottom-30 toward middle) applied as a second draw on a per-bucket re-mapping table.

### Luminous assignment

After all sizes/brightness are drawn, compute the 95th-percentile brightness threshold. For each star, set `aLuminous = (brightness - p95) / (max - p95)` clamped to `[0, 1]`. This is a deterministic post-pass on the array — no second RNG draw needed.

### Twinkle selection

For each star (after `u`, brightness and luminous are known):
1. Compute `pBase = TWINKLE_FRACTION * (1 + TWINKLE_BRIGHTNESS_BIAS * (u - 0.5))` where `u` is the per-star size-uniform draw (equivalently, the brightness rank).
2. Roll `rng() < pBase` for inclusion.
3. If included, draw `aTwinkleSpeed`, `aTwinkleSharp`, `aTwinkleAmp`, `aTwinklePhase`.
4. If `aLuminous > 0`, clamp `aTwinkleAmp ≤ TWINKLE_AMP_LUMINOUS_CAP`.

### Param record

```ts
export const STAR_SEED = 0xc0ffee;          // unchanged
export const STAR_SEED_NEAR = 0xc0ffee ^ 0xa1b2c3;

export const STAR_COUNT_FAR = 1700;         // was STAR_COUNT = 1500
export const STAR_COUNT_NEAR = 500;
export const STAR_RADIUS_FAR = 400;         // unchanged
export const STAR_RADIUS_NEAR = 180;

export const PARALLAX_FACTOR_NEAR = 0.6;

export const STAR_SIZE_MIN = 0.6;           // unchanged
export const STAR_SIZE_MAX = 2.4;           // unchanged
export const STAR_BRIGHTNESS_MIN = 0.35;    // unchanged
export const STAR_BRIGHTNESS_MAX = 1.0;     // unchanged

export const LUMINOUS_PERCENTILE = 0.95;    // top 5% get halo
export const SPIKE_THRESHOLD = 0.7;         // aLuminous > 0.7 gets spikes (top ~1.5%)

export const TWINKLE_FRACTION = 0.14;       // was 0.12
export const TWINKLE_BRIGHTNESS_BIAS = 1.0; // controls magnitude of brightness bias
export const TWINKLE_SHARP_FRACTION = 0.30; // 30% of twinklers use sharp blink curve

export const TWINKLE_AMP_SMOOTH_MIN = 0.35; // was 0.15
export const TWINKLE_AMP_SMOOTH_MAX = 0.65; // was 0.35
export const TWINKLE_AMP_SHARP_MIN = 0.50;
export const TWINKLE_AMP_SHARP_MAX = 0.85;
export const TWINKLE_AMP_LUMINOUS_CAP = 0.25;

export const TWINKLE_SPEED_MIN = 0.4;       // was uniform 1.6
export const TWINKLE_SPEED_MAX = 2.5;

export const PALETTE_BASE: ReadonlyArray<{ readonly color: string; readonly weight: number }> = [
  { color: '#bcd0ff', weight: 0.15 },  // cool blue-white
  { color: '#eef2ff', weight: 0.40 },  // neutral white
  { color: '#fff4dc', weight: 0.25 },  // warm white
  { color: '#ffc89a', weight: 0.12 },  // orange
  { color: '#ff9272', weight: 0.05 },  // deep red-orange
  { color: '#a0b8ff', weight: 0.03 },  // hot blue
];

export const PALETTE_LUMINOUS: ReadonlyArray<{ readonly color: string; readonly weight: number }> = [
  { color: '#bcd0ff', weight: 0.15 },
  { color: '#eef2ff', weight: 0.20 },  // halved
  { color: '#fff4dc', weight: 0.12 },  // halved
  { color: '#ffc89a', weight: 0.12 },
  { color: '#ff9272', weight: 0.15 },  // tripled
  { color: '#a0b8ff', weight: 0.26 },  // tripled
];

export const PALETTE_DIM: ReadonlyArray<{ readonly color: string; readonly weight: number }> = [
  { color: '#bcd0ff', weight: 0.15 },
  { color: '#eef2ff', weight: 0.50 },  // doubled (effectively, since hot/red are zero)
  { color: '#fff4dc', weight: 0.30 },  // doubled
  { color: '#ffc89a', weight: 0.05 },
  { color: '#ff9272', weight: 0.00 },  // zeroed
  { color: '#a0b8ff', weight: 0.00 },  // zeroed
];
```

### Constants removed from `starfieldSpec.ts`

- `STAR_COUNT` (`1500`) — replaced by `STAR_COUNT_FAR` (`1700`) + `STAR_COUNT_NEAR` (`500`).
- `TWINKLE_AMP_MIN` (`0.15`), `TWINKLE_AMP_MAX` (`0.35`) — replaced by smooth/sharp/luminous-cap triplet above.

### Uniforms removed from `starfieldMaterial.ts`

- `uTwinkleSpeed` — replaced by per-star `aTwinkleSpeed` attribute. The `TWINKLE_SPEED` constant in `Starfield.tsx` is also removed.

### Caller updates

`Starfield.tsx` currently imports `STAR_COUNT, STAR_RADIUS, STAR_SEED` from the spec and passes `twinkleSpeed: TWINKLE_SPEED` to the material. These call sites change to import the per-layer constants and stop passing a uniform speed.

---

## Performance budget

| Cost | Before | After |
|---|---|---|
| Draw calls | 1 | 2 |
| Vertices | 1500 | 2200 |
| Vertex attribute memory | ~30 KB | ~106 KB |
| Per-frame CPU work | 1 `Vector3.copy` + 1 uniform tick | 2 `Vector3.copy` (one with `multiplyScalar`) + 1 uniform tick |
| Vertex shader ALU ops | ~5 | ~10 (per-star speed mul, sharp pow, color passthrough) |
| Fragment shader ALU ops (non-luminous, 95% of stars) | ~3 | ~5 |
| Fragment shader ALU ops (luminous, 5%) | n/a | ~15, but only ~5% of points and only on the enlarged sprite pixels |
| Postprocessing passes | 0 | 0 |

Asteroid layer + planet trails dominate render cost by orders of magnitude. Starfield AAA cost remains well under 1% of frame time.

---

## Testing

### Unit tests — `starfieldSpec.test.ts`

Existing assertions stay. New assertions:

- **Layer tag flows through:** `buildStarfieldSpec({ layer: 'far', ... }).count === count`, same for near.
- **Determinism across layer:** two calls with `{ layer: 'far', seed: STAR_SEED, ... }` return byte-identical arrays.
- **Color array shape:** `colors.length === count * 3`. All RGB values ∈ `[0, 1]`.
- **Color distribution:** sample fractions matching each palette bucket are within `±0.04` of the configured weight (on a 1700-sample draw).
- **Luminous fraction:** count of stars with `luminous > 0` is between 4% and 6% of total.
- **Spike fraction:** count of stars with `luminous > 0.7` is between 1% and 2.5%.
- **Twinkle fraction:** count of stars with `twinkleAmp > 0` is between 12% and 16% (the brightness bias means the global expected value is exactly `TWINKLE_FRACTION = 0.14`, but with ±2% tolerance for a 1700-sample draw).
- **Twinkle speed range:** for twinklers, every `twinkleSpeed` ∈ `[TWINKLE_SPEED_MIN, TWINKLE_SPEED_MAX]`.
- **Sharp fraction of twinklers:** among twinklers, fraction with `twinkleSharp = 1` is within `±0.05` of `TWINKLE_SHARP_FRACTION = 0.30`.
- **Amplitude ranges:** smooth twinklers (`twinkleSharp = 0`) have amps ∈ `[TWINKLE_AMP_SMOOTH_MIN, TWINKLE_AMP_SMOOTH_MAX]`; sharp twinklers have amps ∈ `[TWINKLE_AMP_SHARP_MIN, TWINKLE_AMP_SHARP_MAX]`.
- **Luminous twinkle cap:** every star with `luminous > 0` has `twinkleAmp ≤ TWINKLE_AMP_LUMINOUS_CAP`.
- **Brightness bias on twinklers:** mean brightness of twinklers > mean brightness of all stars (sanity check that the bias is producing what it should).

### Unit tests — `starfieldMaterial.test.ts`

- New uniforms are present with correct defaults: `uHaloSizeBoost`, `uHaloStrength`, `uSpikeStrength`.
- Vertex shader source references new attributes: `aColor`, `aLuminous`, `aTwinkleSpeed`, `aTwinkleSharp`.
- Fragment shader source contains halo and spike code paths (string contains assertion is sufficient).

### Manual verification

- Run `pnpm dev`, load the scene.
- **Color variety:** stars show a visible mix — some warm yellow, some cool blue, occasional deep red, occasional bright blue. The mean star is still neutral-white.
- **Twinkle visibility:** after watching the sky for ~5 seconds, twinkling is *obviously* visible — multiple stars perceptibly breathing or flickering at different rates. Not just "I think one might be dimming."
- **Sharp vs smooth:** some twinklers fade slowly, some snap briefly.
- **Bloom halos:** scan for the few brightest stars — they show a soft glow ring rather than a hard point.
- **Diffraction spikes:** the top few stars show a faint cross of light extending past the disc.
- **Parallax:** fly the ship around. Near-layer stars visibly slide relative to far stars. At rest, both layers are still.
- **No occlusion regressions:** planets correctly occlude both star layers; comet trails read cleanly.
- **Frame-time check:** Chrome devtools — no measurable delta vs the pre-upgrade branch.

### Architectural verification

The work touches `services/renderer/` and `components/Scene/` only. No core changes, no port changes, no widget changes. `pnpm check` must pass — typecheck, oxlint, suppressor scan, unit tests.

---

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Real postprocessing bloom (`UnrealBloomPass` etc.) | Full-screen pass cost is ~1ms+ on typical GPUs and would affect everything (planets, ships, UI). Per-star in-shader halo is free and surgical. |
| Texture-based star sprite with baked halo + spikes | One sprite for every star means non-luminous stars also waste fragments on alpha they don't need. Procedural in-shader gating keeps the cheap 95% cheap. |
| Three layers (far / mid / near) | Diminishing return. Two layers already give a clear parallax cue; three doubles the management cost for marginal gain. |
| World-fixed near layer (no follow at all) | Stars would slide off behind the camera as the ship moves through space. Either we'd have to grow the radius huge (expensive) or accept stars vanishing. 0.6× follow keeps them centered while letting motion shear them visibly. |
| Twinkle implemented in CPU per-frame | Wastes CPU on something a sine wave + uniform tick does for free. |
| Color via spectral-class calculation | Real but adds complexity for no visual gain — the 6-bucket palette is indistinguishable from continuous spectrum at point-sprite scale. |
| Per-star color picked from continuous gradient | Same conclusion — discrete buckets render identically and unit-test cleanly. |
| Nebula / Milky-Way wash, galactic-plane clustering | User explicitly deferred. May revisit in a separate spec. |
