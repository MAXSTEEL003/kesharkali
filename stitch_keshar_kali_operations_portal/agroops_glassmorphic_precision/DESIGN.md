---
name: AgroOps Glassmorphic Precision
colors:
  surface: '#fff8f6'
  surface-dim: '#e4d7d4'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fef1ed'
  surface-container: '#f8ebe8'
  surface-container-high: '#f2e6e2'
  surface-container-highest: '#ece0dc'
  on-surface: '#201a18'
  on-surface-variant: '#59413e'
  inverse-surface: '#362f2d'
  inverse-on-surface: '#fbeeea'
  outline: '#8d706d'
  outline-variant: '#e0bfbb'
  surface-tint: '#ae2f2a'
  primary: '#6b0007'
  on-primary: '#ffffff'
  primary-container: '#8f1717'
  on-primary-container: '#ff9d93'
  inverse-primary: '#ffb4ab'
  secondary: '#9e403a'
  on-secondary: '#ffffff'
  secondary-container: '#fe8a81'
  on-secondary-container: '#75221f'
  tertiary: '#422f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#5e4400'
  on-tertiary-container: '#dfb04f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb4ab'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#8d1516'
  secondary-fixed: '#ffdad6'
  secondary-fixed-dim: '#ffb3ad'
  on-secondary-fixed: '#410003'
  on-secondary-fixed-variant: '#7f2925'
  tertiary-fixed: '#ffdea3'
  tertiary-fixed-dim: '#efbf5d'
  on-tertiary-fixed: '#261900'
  on-tertiary-fixed-variant: '#5c4200'
  background: '#fff8f6'
  on-background: '#201a18'
  surface-variant: '#ece0dc'
typography:
  display:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  code-telemetry:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 2.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
This design system serves an enterprise-tier agricultural intelligence and operations management suite, specifically optimized for high-throughput rice cultivation, milling logistics, and grain trade operations.

The aesthetic fuses modern high-clarity **Glassmorphism** with institutional data precision. It moves beyond consumer-grade glass novelties into an engineered, high-visibility workspace:
- **Atmosphere:** Translucent architectural planes hovering over subtle agrarian warmth. It projects prestige, harvest scale, and digital command.
- **Visual Tenets:** Specular edge light, high-density tabular clarity, disciplined warm neutrals, and commanding crimson accents that signify real-time mission-critical telemetry (silo moisture, yield rates, automated harvester fleets).
- **Tone:** Authoritative, pristine, and tactically sophisticated.

## Colors
The palette balances deep heritage crimson tones with the rich golden amber of ripe grain and a warm, ambient translucent canvas.

### Palette Architecture
- **Primary (`#8F1717` - Deep Crimson Red):** Anchors main transactional actions, critical thresholds, key data callouts, and primary active states.
- **Secondary (`#5E1010` - Deep Burgundy):** Reserved for enterprise structural navigation, top-level headers, active selected pill fills, and grounding elements.
- **Tertiary / Accent (`#C69A3B` - Muted Metallic Gold / Amber):** Highlights premium metrics, yield performance indicators, operational milestones, and warm specular micro-accents.
- **Neutral Surface & Canvas:**
  - Base Background: Ambient linear sweep moving dynamically between `#FBF9F6`, `#F5EEE8`, and `#F7F3ED`.
  - Glass Surface: `rgba(255, 255, 255, 0.75)` backed by `backdrop-filter: blur(16px) saturate(180%)`.
  - Elevated Glass: `rgba(255, 255, 255, 0.88)` for dropdowns, popovers, and contextual modals.
  - Border Specular: `rgba(255, 255, 255, 0.65)` on top/left edges grading to `rgba(214, 203, 192, 0.35)` on bottom/right edges.
- **Text & Foreground:**
  - Primary Content: `#241E1C` (deep earthen charcoal) guaranteeing AA/AAA contrast over frosted white fields.
  - Secondary Content: `#6B5E59` for metadata, unit labels, and secondary table columns.

## Typography
The typography pairing addresses two core enterprise requirements: architectural technical authority and fatigue-free operational readability.

- **Headlines (Space Grotesk):** Provides a modern, geometric structural cadence. The subtly sculpted letterforms convey advanced industrial technology and precision logistics.
- **Body & Controls (Plus Jakarta Sans):** Offers balanced proportions, wide apertures, and clean legibility across complex operational tables, forms, and charts.
- **Telemetry & Metrics (JetBrains Mono):** Dedicated to moisture percentages, lot tracking codes, sensor streams, grain tonnage, and geo-coordinates, ensuring zero numerical ambiguity.

## Layout & Spacing
The layout adheres to a flexible 12-column grid engine optimized for multi-pane enterprise portals and dynamic operations centers.

- **Desktop (1440px+):** 12-column structure with fixed 320px contextual left-rail operations navigation, `2.5rem` outer margins, and `1.5rem` gutters.
- **Tablet (768px - 1024px):** Reflows into an 8-column layout with collapsable drawer navigation and `1.25rem` gutters.
- **Mobile (< 768px):** Single-column stacked structure with `1rem` margins and `0.75rem` internal component gutters. Multi-metric KPI bars convert into horizontal snap-scrolling carousels to preserve density without sacrificing legibility.

## Elevation & Depth
Elevation is realized through physical optical stratification rather than raw opacity steps:

1. **Base Foundation (Ground Canvas):**
   - Soft gradient underlay `#FBF9F6` to `#F7F3ED` overlaid with faint tonal micro-topography contours at 4% opacity.

2. **Level 1 — Operational Panels & Glass Cards:**
   - Background: `rgba(255, 255, 255, 0.75)`
   - Filter: `backdrop-filter: blur(16px) saturate(180%)`
   - Shadow: `0 8px 32px -4px rgba(94, 16, 16, 0.05), 0 2px 8px -1px rgba(36, 30, 28, 0.03)`
   - Border: `1px solid rgba(255, 255, 255, 0.65)` with an inner inset box-shadow `inset 0 1px 1px 0 rgba(255, 255, 255, 0.8)` (specular top highlight).

3. **Level 2 — Interactive Overlays, Command Drawers & Tooltips:**
   - Background: `rgba(255, 255, 255, 0.88)`
   - Filter: `backdrop-filter: blur(24px) saturate(200%)`
   - Shadow: `0 16px 48px -8px rgba(94, 16, 16, 0.12), 0 4px 16px -2px rgba(36, 30, 28, 0.06)`
   - Border: `1px solid rgba(198, 154, 59, 0.35)` (infused with a subtle metallic amber refraction).

4. **Level 3 — Critical Alerts & Active States:**
   - Glow: `0 0 24px 0 rgba(143, 23, 23, 0.25)` diffused shadow creating localized luminance behind critical status cards or high-priority override actions.

## Shapes
The design system enforces a deliberate geometric hierarchy: **pill-shaped ergonomics for interactive touchpoints** paired with **softly structured rounded rectangles for analytical surfaces**.

- **Cards & Data Modules:** Enforce `1.5rem` (`rounded-xl` equivalent via level 2 scaling) to create liquid, floating surfaces.
- **Modals & Flyouts:** `1.5rem` exterior corners to match card silhouettes.
- **Buttons, Badges, Filter Pills, and Segmented Switches:** Strictly full-radius (`rounded-full` / 9999px) pill styling. This contrast makes interactive objects instantly distinguishable from analytical content containers.
- **Input Fields & Form Selectors:** Fixed at `0.75rem` to anchor typing ergonomics.

## Components

### Buttons
- **Primary Pill:** Background filled with Deep Crimson `#8F1717`, label text in pure white (`#FFFFFF`). Exterior shadow: `0 4px 14px rgba(143, 23, 23, 0.3)`. Hover transitions to `#5E1010` with slight scale (`1.01`).
- **Accent Pill (Harvest / Optimize):** Background filled with Muted Amber `#C69A3B`, text `#241E1C`. Used for yield calculations, reports, and export triggers.
- **Glass Secondary Pill:** Background `rgba(255, 255, 255, 0.5)`, border `1px solid rgba(255, 255, 255, 0.8)`, text `#241E1C`. Hover shifts to `rgba(255, 255, 255, 0.9)`.
- **Pill Shape Standard:** Height `42px` (standard) or `34px` (dense operations mode), padding `0 24px`, full border-radius (`9999px`).

### Badges & Status Chips
- Height `24px`, border-radius `9999px`, padding `0 12px`.
- Typography: `code-telemetry` at 11px uppercase.
- Variants:
  - *Active Milling / Optimal:* Translucent amber-gold tint (`rgba(198, 154, 59, 0.15)`), border `1px solid rgba(198, 154, 59, 0.4)`, text `#8E6D23`.
  - *Critical Moisture / High Temp:* Translucent crimson tint (`rgba(143, 23, 23, 0.12)`), border `1px solid rgba(143, 23, 23, 0.35)`, text `#8F1717`.
  - *Silo Stored / Stable:* Translucent slate (`rgba(107, 94, 89, 0.1)`), border `1px solid rgba(107, 94, 89, 0.25)`, text `#5E1010`.

### Data Cards
- Structure: Constructed with `rgba(255, 255, 255, 0.75)` backdrop blur fill, `1.5rem` corner radius, `space-lg` inner padding.
- Edge Definition: Hairline border `rgba(255, 255, 255, 0.7)` top/left with specular refraction.
- Header Zone: Space Grotesk `headline-sm` with right-aligned telemetry chip.

### Input Fields
- Container: Height `44px`, background `rgba(255, 255, 255, 0.6)`, corner radius `0.75rem`.
- Border: `1px solid rgba(214, 203, 192, 0.5)`.
- Focus State: Surface clears to `rgba(255, 255, 255, 0.95)`, border transitions to `#8F1717` with a subtle glow `0 0 0 3px rgba(143, 23, 23, 0.12)`.

### Checkboxes & Radios
- Checkboxes: `18px x 18px`, `6px` radius. Inactive: `rgba(255, 255, 255, 0.8)` with `#D6CBC0` border. Active: Solid `#8F1717` fill with white checkmark glyph.
- Radio Buttons: Circular `18px`, inner active dot rendered in `#C69A3B` against a `#5E1010` rim.

### Data Tables (Enterprise Telemetry Lists)
- Row Height: `48px` compact, `56px` relaxed.
- Header: Sticky translucent glass ribbon (`rgba(245, 238, 232, 0.85)`), text styled with `label-md` in uppercase `#6B5E59`.
- Row Hover: Smooth background transition to `rgba(255, 255, 255, 0.65)` with a left indicator strip in `#8F1717` (`3px` width).