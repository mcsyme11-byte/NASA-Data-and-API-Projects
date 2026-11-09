# Design guide — "old money", under a night sky

NASA and ESA Data Projects share the look of the developer's other projects (the Flight Deck Suite and Hot Mic): navy,
brass and cream, serif type and thin brass rules; calm and precise, like a well-kept paper logbook. The one addition
is a quiet night sky: a faint field of brass and cream stars behind the home page.

The values live in `shared/theme.css`. When in doubt, copy an existing component rather than inventing a new one.

## 1. Principles

1. **Calm and readable at a glance.** Big numbers, small labels, short notes. No paragraph where a number will do.
2. **Numbers people can picture.** "3.2 Moon distances", "as wide as two football fields", next to the exact value.
3. **Brass is for meaning, not decoration.** Labels, rules, the main button, selected states, the first chart series.
4. **Plain English.** Explain every science word the first time it appears (sol, Ls, LD), behind an ⓘ where possible.
5. **Honest data.** Estimates look like estimates (ranges, "about"), gaps in the data stay visible, and every chart
   says where its numbers came from.

## 2. Colour

| Role | Token | Value |
|---|---|---|
| Background (navy) | `--bg` | `#141B26` |
| Bars | `--bg2` | `#0F1520` |
| Card | `--card` | `#1A2333` |
| Charts, maps, image frames | `--deep` | `#0C1119` |
| Hairline / stronger border | `--line` / `--line2` | `#2A3446` / `#3A465C` |
| **Brass** (labels, accents, main button) | `--brass` | `#C0A062`; bright `#E2C88E`; dim `#7E6A45` |
| Cream text / secondary / muted | `--ink` / `--ink2` / `--muted` | `#EDE6D3` / `#B4AFA2` / `#98A0AB` |
| Faint (disabled) | `--faint` | `#5E6775` |

**Status:** good `#8FB996`, problem `#C9675A`, caution `#D1A956`, information `#8AA9C9`.

**Page background:** navy with a faint brass glow at the top,
`radial-gradient(800px 420px at 50% -160px, rgba(192,160,98,.10), transparent 70%), #141B26`.

## 3. Type

- **Everything is serif:** `Georgia, "Palatino", "Palatino Linotype", "Book Antiqua", serif`.
- **Numbers:** `lining-nums tabular-nums`, so digits line up and don't jump as they change.
- **Code-like text** (IDs, coordinates, URLs): monospace, 12.5px, muted.

| Use | Style |
|---|---|
| Page title | 34px (44px on the home page), weight 400 |
| Eyebrow / section label | 11px, uppercase, brass, letter-spacing .32–.42em |
| Tile label | 10.5px, uppercase, brass, letter-spacing .26em |
| Big number | 26px |
| Body | 16px/1.5 |
| Note | 12.5–13px, italic, muted |
| Buttons | 14px, uppercase, letter-spacing .2em |

## 4. Spacing and shape

- Page gutter 16px; content at most 1440px wide.
- Card padding 22px; gaps of 22px between cards; tiles joined by 1px hairlines.
- Corners: 3px on buttons, chips and fields; 6px on cards, tiles and frames.
- Cards have a dim-brass top rule. No drop shadows.

## 5. Components

The classes in `shared/theme.css`:

| Component | Class | Notes |
|---|---|---|
| Top bar | `.topbar`, `.brand`, `.nav` | Sticky, 64px; the open page brass and underlined |
| Page head | `.phead`, `.eyebrow`, `h1`, `.lede` | A dim-brass rule under it |
| Section header | `.shead` with `h2` and `.aside` | Brass caps left, italic muted aside right |
| Card | `.card` | |
| Tiles (KPIs) | `.tiles` › `.tile` › `.label`, `.value`, `.note` | Label → big number → italic note |
| Buttons | `.btn`, `.btn.ghost` | Main = brass gradient with navy text; ghost = dim-brass outline |
| Filter chips | `.chip[aria-pressed]` | 36px; the chosen one brass |
| Fields | `input`, `select` | 44px, deep navy, brass border on focus |
| Status pill | `.pill.good/.bad/.warn/.info` | Caps, coloured outline |
| Tag | `.tag` | Italic, outlined (for example "Potentially hazardous") |
| Tabs | `.tabs` (Asteroid Tracker) | Caps, brass underline on the open tab; scroll sideways on narrow screens |
| How to read this | `details.howto` | Closed by default; brass caps summary with a › that turns |
| Notice | `.notice`, `.notice.warn` | A bordered box for messages |
| Chart / map / image frame | `.frame` | Deep navy with a hairline |
| Footer | `.footer`, `.credit` | Site links (added by `shared/footer.js`), data acknowledgements, then the credit |
| Site links | `.sitelinks` | About · Privacy · Terms · Credits · Contact · Licence (MIT) ↗ · Source code ↗; every page loads `shared/footer.js` |
| Reading page | `.prose`, `.summary`, `.updated`, `table.credits` | About, Privacy, Terms and Credits: the full content width (decided Nov 9, 2026), a brass-ruled summary, the date of the last update |
| Back button | `.backlink#back` | "‹ Back to …" above the heading, named for the previous page and using the browser's Back; "‹ Home" when the page was opened directly (wired by `shared/footer.js`) |

## 6. Charts

- **Background** `--deep`, gridlines `--line`, axis text 11px muted serif, axis titles in brass caps.
- **Series colours, in order:** brass `#C0A062`, blue `#8AA9C9`, green `#8FB996`, copper `#C9784A`, lilac `#B79AC8`,
  amber `#D1A956` (`--s1` to `--s6`). Never more than six; group the rest as "Other".
- **Highlight** with brass-bright `#E2C88E`; everything else dims.
- **Hazard / warning** uses `--red` only for things that are actually flagged (for example NASA's "potentially
  hazardous" flag), never for decoration.
- **Every chart** has a title, units on its axes, a one-line source note under it (italic, muted), and a tooltip
  with exact values. Colour is never the only way to tell series apart (labels or shapes too).
- **Estimates** (asteroid diameters) are drawn as a range (a bar from min to max), not one point.

## 7. Screen sizes

Everything must look right at 375, 390, 430 (phones; 320 must not break), 768, 1024 (tablets), 1280 and 1440+
(computers). Below 760px the nav collapses and buttons go full width.

## 8. Accessibility

- Text contrast at least 4.5 : 1 (cream and brass on navy both pass).
- Every control reachable and usable from the keyboard, with a visible focus ring.
- Images have descriptions (NASA's own captions where there are).
- Motion is never needed to understand anything, and stops with "reduce motion".

## 9. Quality checklist (every change)

1. Look at the page at all the widths above.
2. Check the empty, loading and error states (no results, NASA out of reach, the demo key used up).
3. No console errors.
4. Rows of tiles have equal heights; spacing is even.
