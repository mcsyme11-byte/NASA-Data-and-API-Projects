# Design guide — "old money", under a night sky

NASA and ESA Data Projects share the look of the developer's other projects (the Flight Deck Suite and Hot Mic): navy,
brass and cream, serif type; calm and precise, like a well-kept paper logbook. The one addition is a quiet night sky:
a faint field of brass and cream stars behind the home page and the Contact page.

**Version 2 (decided Nov 13, 2026).** The site was rebuilt on one shared set of components after pieces added page by
page had left several versions of the same thing (four kinds of tiles, three tables, three "How to read this" boxes,
page styles inside most pages). Since then:

- every component exists **once**, in `shared/theme.css`, and is shown on the component page, `design/index.html`
  (open it at `/design/` on the site);
- pages use only those components; a project style sheet holds only **the inside of its tools** (see "Page styles");
- a new component is added to `shared/theme.css` and the component page first, after a mock-up the developer approves,
  **saying which existing piece it replaces or why none fits**;
- `python3 dev/check_styles.py` checks this, and GitHub runs it after every push.

## 1. Principles

1. **Calm and readable at a glance.** Real headings, big numbers, small labels, short notes.
2. **A box means something.** A card (`.card`) is a thing you open; a panel (`.panel`) holds one chart, map or table;
   a control box (`.ctl`) holds a group of settings beside a tool. Writing, figures and lists sit on the page itself.
3. **Numbers people can picture.** "3.2 Moon distances", "as wide as two football fields", next to the exact value.
4. **Brass is for meaning, not decoration.** Kickers, labels, the main button, the chosen state, the first chart series.
5. **Plain English.** Every science word explained the first time it appears (sol, Ls, LD).
6. **Honest data.** Estimates look like estimates (ranges, "about"), gaps in the data stay visible, and every chart
   says where its numbers came from.
7. **Nothing added without something considered for removal.** A new section or control says what it replaces; if it
   repeats what is already on the page (a list of what the page can do beside cards that say the same), it is left out.

## 2. Colour

| Role | Token | Value |
|---|---|---|
| Background (navy) | `--bg` | `#141B26` |
| Bars, fields | `--bg2` | `#0F1520` |
| Card / card on hover | `--card` / `--card2` | `#1A2333` / `#1E2839` |
| Panels: charts, maps, tables, image frames | `--deep` | `#0C1119` |
| Hairline / stronger border | `--line` / `--line2` | `#2A3446` / `#3A465C` |
| **Brass** (kickers, accents, main button) | `--brass` | `#C0A062`; bright `#E2C88E`; dim `#7E6A45` |
| Cream text / secondary / muted | `--ink` / `--ink2` / `--muted` | `#EDE6D3` / `#B4AFA2` / `#98A0AB` |
| Faint (disabled, placeholders) | `--faint` | `#5E6775` |

**Status:** good `#8FB996`, problem `#C9675A`, caution `#D1A956`, information and ESA `#8AA9C9`.

**Page background:** navy with a faint brass glow at the top.

## 3. Type

- **Everything is serif:** `Georgia, "Palatino Linotype", "Book Antiqua", Palatino, serif`.
- **Numbers:** `lining-nums tabular-nums`, so digits line up and don't jump as they change.
- **Three heading sizes and five text sizes**, nothing in between:

| Use | Size (phone) | Class |
|---|---|---|
| Page title | 46 px (34); tool pages 38 px (30) | `h1`, `.pagehead.compact` |
| Section heading | 30 px (25) | `h2` |
| Card, panel and step title | 21 px (19); in a panel 18 px | `h3` |
| Lede, under the page title | 20 px (18) | `.lede` |
| Body | 17 px | |
| Small | 14.5 px | `.small` |
| Caption, note, aside (italic, muted) | 13.5 px | `.caption`, `.note`, `.aside` |
| Kicker, label, tab, button (small capitals) | 11–12 px | `.kicker`, `.label`, `.lbl`, `.tabs`, `.btn` |

**Small capitals only for kickers, labels, tabs and buttons, never as a section's heading.** Every section has a real
`h2`. The one exception is the small title of a control box (`.ctl > h2`), which names a group of settings.

## 4. Spacing and shape

- **One spacing scale:** 4, 8, 12, 16, 24, 32, 48, 72 px (`--sp1` to `--sp8`; on phones 48 and 72 become 36 and 52).
  Every margin and padding is one of these.
- Content at most 1200 px wide, with a 32 px gutter (16 px on phones). Decided Nov 13, 2026: left-aligned text
  (paragraphs, ledes, notes) runs the full width of the content; only a two-column layout (`.split`) narrows it.
  Centred text (the centred page heads, empty and loading states) stays narrower, at most 40 em, with its lines
  balanced to even lengths. Headings are balanced too, and paragraphs never end on a single word.
- Sections are 72 px apart (52 on phones); a section's heading sits 24 px above its content.
- Corners: 4 px on buttons, fields and segmented controls; 6 px on cards, panels and boxes; round on chips and badges.
- No drop shadows except on things that float (tooltips, the picture viewer, suggestion lists).

## 5. Components

All in `shared/theme.css`, all shown on `design/index.html`. Use these; do not restyle them in a page.

| Component | Class | Use |
|---|---|---|
| Top bar | `.topbar`, `.brand` › `.emblem` + `.bname`, `.nav` | Sticky, 60 px; on phones only the emblem shows beside the four links |
| Back | `.backlink#back` | Above the page head on every page except the site's home page; the arrow is drawn by the style sheet; named for the previous page by `shared/footer.js` |
| Page head | `header.pagehead` › `.kicker`, `h1`, `.lede`, `.meta` | `.compact` for tool pages, `.center` for the home and Contact pages, `.medal` for the emblem above a centred head |
| Section | `section.section` › `.section-head` › `div` (`.kicker` + `h2`), then `.aside` or a button | `.section-head.sub` for a heading inside a tool view |
| View heading | `.viewhead` › `h2`, `.lede` | The top of one tab of a tool |
| Stats | `.stats` › `.stat` › `.label`, `.value` (unit in `small`), `.note` | A strip of up to five figures, not boxes; `.tiles`/`.tile` are the same component under their older names |
| Cards | `.cards` (`.three`, `.two`) › `a.card` › `.kicker`, `h3`, `p`, `.foot` (badges + `.go`) | Something you open; the whole card is the link. `.card.feature` adds a picture on top (`.media`); `.card.muted` is a dashed card for something planned |
| Panel | `.panel` › `.ph` (`h3` + `.aside`), `.pb` (`.flush` for tables), `.pf`, `details.howto` | One chart, map or table; `.panels` lays them out two across (`.wide` spans both) |
| How to read this | `details.howto` › `summary` + paragraphs | At the foot of a panel, or as a box of its own; closed by default |
| Control box | `.ctl` › `h2` (small title), controls, `.caption` | A group of settings beside a tool (the Earth map's layers, the globe's selection) |
| Buttons | `.btn`, `.btn.outline`, `.btn.quiet`; `.small` | Primary (brass), outline, quiet; `.ghost` is the older name of `.outline` |
| Text button | `.linkbtn` | An underlined action inside text ("Try again") |
| Segmented control | `.seg` › `button` (or `.chip`), optional `.lbl` inside | One choice of a few (a time step, a view, a distance); scrolls sideways with a fade if it does not fit |
| Chips | `.chips` › `.chip[aria-pressed]` | Filters that turn on and off independently |
| Tabs | `nav.tabs` | The views of one tool; wrap to a second line when they don't fit |
| Period bar | `.periodbar` › `.seg`, `.period` (`.lbl` + `strong` or a field), `.grow`, a button | Step through weeks, years or days |
| Filters | `.filters` › `.seg`, `label` + `select`/`input`, `.count` | The filter row above a chart or list |
| Fields | `input`, `select`, `.field` | 44 px, dark, brass ring on focus |
| Search box | `label.bigsearch` › icon `svg`, `input[type=search]`, `.qclear` | Clear appears once there is something to clear; `.large` for a page's main search |
| Badges | `.badge`, `.badge.nasa`, `.badge.esa`, `.badge.live`, `.badge.warn` | The agency of a source, a status; `.pill`, `.tag`, `.agency` are older names of the same component |
| What you need | `.need.n-eye`, `.n-bino`, `.n-small`, `.n-large`, `.n-faint` | What is needed to see an object in the sky (Asteroid Tracker and Sky Finder), one colour per instrument |
| Notices | `.notice`, `.notice.warn`, `.notice.error` | A message with an icon, and an action button at the end |
| States | `.state`, `.empty`, `.loading` | No results, loading, could not be loaded |
| Tables | `table.table` (`.stack` turns rows into cards on phones), `table.credits` | Brass small-capital headings, hairline rows; `.r` right-aligns numbers |
| Writing | `.prose`, `.summary`, `.updated`, `.list`, `.facts` › `.f`, `.terms` (`dt`/`dd`), `.steps` | Reading pages, short facts beside text, a glossary, numbered steps |
| Sources | `.sources` › `.s` › `.n` (name + badge), `.d`, `.u` | Where a project's data comes from |
| Two columns | `.split` | Reading on the left, facts on the right |
| Chart parts | `svg.chart` (`.grid`, `.axt` axis titles, `.dim`), `.legend` (`.s1`–`.s6` swatches), `.tip` | Axis text, gridlines, a chart's key and its tooltip |
| Callout, stage | `.pf.callout` › `.t` + a button; `a.stage` › `canvas` | A line of text with one action, at the foot of a panel; a canvas that fills a panel and opens something |
| Data credits | `p.srcline` | A page's detailed credits, just above the footer |
| Footer | `.footer` › `.ftop` › `.copy`, `.fnote` (links added by `shared/footer.js`) | Decided Nov 12, 2026: one row of links and the copyright, then one short credit line; nothing else |

## 6. Page styles

Decided Nov 13, 2026: **a page adds no styles of its own** (no `<style>` block, no `style="…"` attribute). A project's
style sheet (`asteroid-tracker/tracker.css`, `image-explorer/explorer.css`, `mars-data/mars.css`,
`spacecraft/spacecraft.css`, `sky-finder/sky-finder.css`) holds only the inside of its tools: the chart drawing, the
maps and their buttons, the orbit diagram, the globe, the picture viewer, the asteroid tables. It may adjust a shared
component inside its own parts (`.mapbar .seg`, `.chip.play`), never restyle one on its own (`.btn { … }`). Values a
script works out from data (a key's colour, a tooltip's position) are set by the script.

Sky Finder is a home-screen app with its own app bar and full-screen view; its style sheet keeps those, on the same
colours, type and buttons.

## 7. Charts

- **Background** `--deep` (the panel), gridlines `--line`, axis text 11 px muted serif, axis titles in brass capitals.
- **Series colours, in order:** brass `#C0A062`, blue `#8AA9C9`, green `#8FB996`, copper `#C9784A`, lilac `#B79AC8`,
  amber `#D1A956` (`--s1` to `--s6`). Never more than six; group the rest as "Other".
- **Highlight** with brass-bright `#E2C88E`; everything else dims.
- **Hazard / warning** uses `--red` only for things that are actually flagged (for example NASA's "potentially
  hazardous" flag), never for decoration.
- **Every chart** sits in a panel with a title, units on its axes, a source line under it, a tooltip with exact values
  and a "How to read this". Colour is never the only way to tell series apart (labels or shapes too).
- **Estimates** (asteroid diameters) are drawn as a range (a bar from min to max), not one point.
- **Agencies:** every source line names the agency the numbers come from (NASA, NASA/JPL, ESA). No agency logos or
  agency colours; NASA and ESA data share the same series colours.
- **Labels drawn over maps and diagrams** get a dark outline (canvas `strokeText`, SVG `paint-order: stroke`).

## 8. Screen sizes

Everything must look right at 320, 375, 390 (phones), 768, 1024 (tablets), 1280 and 1440 (computers).

## 9. Accessibility

- Text contrast at least 4.5 : 1 (cream and brass on navy both pass).
- Every control reachable and usable from the keyboard, with a visible brass focus ring.
- Images have descriptions (NASA's own captions where there are); decorative pictures have empty `alt`.
- One `h1` per page; headings in order.
- Motion is never needed to understand anything, and stops with "reduce motion".

## 10. Feel (decided Nov 12, 2026; version 2 since Nov 13)

- **Feedback:** everything pressable changes colour or border over 0.15 s on hover; buttons, chips and segments move
  down 1 px while pressed; cards and pictures lift 2 px on hover. "Reduce motion" turns this off.
- **Tap targets:** at least 40 px tall on phones (44 px for the main buttons and fields).
- **Rows that don't fit:** segmented controls and chip rows scroll sideways on phones with a soft fade on the side where
  there is more, and the chosen button scrolled into view (`shared/footer.js`: `.seg`, `.popular`, `[data-hscroll]`).
  Tabs wrap instead.
- **Fields:** a brass ring on focus; date pickers, dropdowns and scrollbars drawn dark (`color-scheme: dark`); short
  placeholders that fit a 375 px phone.
- **The top bar** is solid, so nothing shows through it while scrolling.

## 11. Quality checklist (every change)

1. `python3 dev/check_styles.py` and `python3 dev/check_wording.py` pass.
2. Look at the page at all the widths above, with real data, with the data missing and with NASA out of reach.
3. No console errors.
4. At 320 and 375 px: nothing runs off the screen, nothing is cut off inside its box, tap targets are 40 px or taller.
5. Hover, press and focus look right on every control.
6. The page uses only the components above; anything new went through the component page first.
