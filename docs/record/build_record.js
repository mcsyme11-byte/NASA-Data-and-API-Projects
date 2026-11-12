// NASA and ESA Data Projects · Project Record · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Builds the Project Record (as a Word document, made into the PDF by build.sh) from the repository: the hand-written
// front matter (front.md, glossary.md), every project document listed in PARTS below (Markdown, rendered with its
// headings, lists, tables, code and links), the repository's history, the site's pages and the working rules
// (export_extras.py).
//   node build_record.js <repo root> <extras.json> <out.docx> [diagram.png]
// Rebuilt after every update (docs/record/build.sh). Uses the npm packages "docx" and "marked".

'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked } = require('marked');
const D = require('docx');

const [ROOT, EXTRAS, OUT, DIAGRAM_ARG, TOC_ARG] = process.argv.slice(2);
const DIAGRAM = DIAGRAM_ARG && DIAGRAM_ARG !== '-' ? DIAGRAM_ARG : null;
// page numbers for the contents, measured on a first build (build.sh); without them Word fills the contents on opening
const TOC_PAGES = TOC_ARG && fs.existsSync(TOC_ARG) ? JSON.parse(fs.readFileSync(TOC_ARG, 'utf8')) : null;
const X = JSON.parse(fs.readFileSync(EXTRAS, 'utf8'));
const GH = 'https://github.com/mcsyme11-byte/NASA-ESA-Data-and-API-Projects/blob/main/';

// ------------------------------------------------------------------------------------------------ what goes in
const PARTS = [
  { title: 'Introduction', docs: [['docs/record/front.md', { noSource: true, keepH1: true }], ['README.md', { title: 'The projects in brief' }], ['docs/record/README.md', { title: 'How this record is made' }]] },
  { title: 'Status and Roadmap', intro: 'What is agreed next and every pending to-do.', docs: [['docs/ROADMAP.md', { title: 'Roadmap' }]] },
  { title: 'Project History', docs: [['docs/HISTORY.md', {}]] },
  { title: 'Change Log', intro: 'Every change to the site and the projects, newest first.', docs: [['CHANGELOG.md', { title: 'Change log' }]] },
  { title: 'Asteroid Tracker', intro: 'Project 1: the near-Earth objects passing Earth, from NASA/JPL and ESA.', docs: [['asteroid-tracker/README.md', {}], ['sky-finder/README.md', { title: 'Sky Finder' }]] },
  { title: 'Spacecraft map', intro: 'A utility: the active spacecraft of NASA, ESA and others, from low Earth orbit to the Voyagers.', docs: [['spacecraft/README.md', {}]] },
  { title: 'Image Explorer', intro: 'Project 2: the Earth from orbit, a globe inside the sky, and the picture libraries of NASA and ESA.', docs: [['image-explorer/README.md', {}]] },
  { title: 'Mars Data', intro: 'Project 3: weather measured on Mars, cleaned, organised, analysed and charted.', docs: [['mars-data/README.md', {}], ['mars-data/analysis/CLEANING.md', { title: 'Mars Data: cleaning rules' }]] },
  { title: 'Data Sources', intro: 'Every NASA and ESA source the projects use: addresses, keys, limits, terms and credit lines.', docs: [['docs/DATA-SOURCES.md', { title: 'Data sources' }]] },
  { title: 'Design Language', intro: 'The navy, brass and cream look every page follows.', docs: [['docs/DESIGN.md', {}]] },
  { title: 'Decisions and Working Rules', generated: 'decisions', docs: [['docs/PROJECT-NOTES.md', { title: 'Project notes and decisions' }]] },
  { title: 'The Site\'s Pages', intro: 'The About, Privacy, Terms of use, Credits and Contact pages, as they appear on the site.', generated: 'legal' },
  { title: 'Licence and Credits', intro: 'The project\'s licence, and every outside data source and library with its terms.', docs: [['LICENSE.md', { title: 'Licence' }], ['CREDITS.md', { title: 'Credits' }]] },
  { title: 'Repository History', intro: 'Every change saved to the repository, newest first, except the daily data updates (counted, not listed).', generated: 'history' },
  { title: 'Glossary', docs: [['docs/record/glossary.md', { noSource: true, keepH1: false, title: 'Glossary' }]] },
];

// Everything else goes in by itself, so nothing is ever missed: any Markdown or text document in the repository that
// isn't listed above and isn't left out on purpose (below) gets a chapter in "Newly added documents", and the build
// names it. A chat then moves it into its proper Part above. (Decided Oct 27, 2026: everything in, every time.)
const LEFT_OUT = [
  [/^docs\/handoffs\//, 'working notes between chats'],
  [/^docs\/CLAUDE-PROJECT-SETUP\.md$/, "the Claude project's set-up"],
  [/(^|\/)tests?\//, 'test data'],
  [/(^|\/)(LICENSE[^/]*|THIRD-PARTY-NOTICES[^/]*)$/i, 'licence texts (the libraries\' own; the project\'s licence is in Part Licence and Credits)'],
  [/(^|\/)vendor\//, 'copies of outside libraries'],
  [/(^|\/)data\//, 'data files'],
  [/^\.github\//, 'GitHub settings'],
  [/^CLAUDE\.md$/, 'its standing rules are in Part Decisions and Working Rules; the rest is set-up for Claude'],
];
{
  const listed = new Set(PARTS.flatMap(p => (p.docs || []).map(d => d[0])));
  const all = execSync(`git -C "${ROOT}" ls-files -z -- "*.md" "*.txt"`).toString().split('\0').filter(Boolean);
  const fresh = all.filter(f => !listed.has(f) && !LEFT_OUT.some(([re]) => re.test(f))).sort();
  if (fresh.length) {
    PARTS.splice(PARTS.findIndex(p => p.generated === 'decisions'), 0, { title: 'Newly added documents',
      intro: "Documents added to the repository that don't have their own place in this record yet. Each is here in full until it is moved into its Part.",
      docs: fresh.map(f => [f, {}]) });
    console.error('Newly added documents (not yet in PARTS): ' + fresh.join(', '));
  }
}

// ------------------------------------------------------------------------------------------------ look
const NAVY = '141B26', NAVY2 = '24314A', BRASS = '9A7A3C', BRASS_SOFT = 'E8DDC4', INK = '1D222B', MUTED = '5E6775', ZEBRA = 'F7F4EC', CODEBG = 'F3F1EA', RULE = 'C8B58A';
const SERIF = 'Georgia', MONO = 'Consolas';
const PAGE_W = 12240, PAGE_H = 15840, MARGIN = 1300, CONTENT_W = PAGE_W - 2 * MARGIN;

// ------------------------------------------------------------------------------------------------ helpers
const unesc = s => String(s == null ? '' : s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
let numberingInstance = 0;
const lastChanged = {};
function changed(rel) {
  if (!(rel in lastChanged)) {
    try { lastChanged[rel] = execSync(`git -C "${ROOT}" log -1 --format=%cs -- "${rel}"`).toString().trim(); } catch (e) { lastChanged[rel] = ''; }
  }
  return lastChanged[rel];
}
function linkFor(href, rel) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (/^mailto:/i.test(href)) return null;
  if (href.startsWith('#')) return null;
  const clean = href.split('#')[0];
  if (!clean) return null;
  const p = path.posix.normalize(path.posix.join(path.posix.dirname(rel), clean));
  if (p.startsWith('..')) return null;
  return GH + encodeURI(p);
}

function runs(tokens, rel, base = {}) {
  const out = [];
  for (const t of tokens || []) {
    switch (t.type) {
      case 'text':
        if (t.tokens && t.tokens.length) out.push(...runs(t.tokens, rel, base));
        else out.push(new D.TextRun({ text: unesc(t.text), ...base }));
        break;
      case 'escape': out.push(new D.TextRun({ text: unesc(t.text), ...base })); break;
      case 'strong': out.push(...runs(t.tokens, rel, { ...base, bold: true })); break;
      case 'em': out.push(...runs(t.tokens, rel, { ...base, italics: true })); break;
      case 'del': out.push(...runs(t.tokens, rel, { ...base, strike: true })); break;
      case 'codespan': out.push(new D.TextRun({ text: unesc(t.text), ...base, font: MONO, size: Math.max(14, (base.size || 20) - 2), color: NAVY2 })); break;
      case 'br': out.push(new D.TextRun({ text: '', break: 1 })); break;
      case 'link': {
        const url = linkFor(t.href, rel);
        const inner = runs(t.tokens, rel, url ? { ...base, color: '2B5A8C', underline: {} } : base);
        if (url) out.push(new D.ExternalHyperlink({ link: url, children: inner }));
        else out.push(...inner);
        break;
      }
      case 'image': out.push(new D.TextRun({ text: '[' + unesc(t.text || 'image') + ']', ...base, italics: true, color: MUTED })); break;
      case 'html': {
        const txt = unesc(t.text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''));
        if (txt.trim()) out.push(new D.TextRun({ text: txt, ...base }));
        break;
      }
      default:
        if (t.tokens) out.push(...runs(t.tokens, rel, base));
        else if (t.text) out.push(new D.TextRun({ text: unesc(t.text), ...base }));
    }
  }
  return out;
}

function plain(tokens) {
  let s = '';
  for (const t of tokens || []) s += t.tokens ? plain(t.tokens) : unesc(t.text || '');
  return s;
}

// every Part and chapter heading, in order, for the contents (with a bookmark each, so the contents can link to it)
const HEADS = [];
const LEVELS = { 1: D.HeadingLevel.HEADING_1, 2: D.HeadingLevel.HEADING_2, 3: D.HeadingLevel.HEADING_3, 4: D.HeadingLevel.HEADING_4, 5: D.HeadingLevel.HEADING_5, 6: D.HeadingLevel.HEADING_6 };
function H(level, kids, title) {
  if (level <= 2) {
    const id = '_Toc' + String(100000 + HEADS.length);
    HEADS.push({ title: title.replace(/\s+/g, ' ').trim(), level, href: id });
    kids = [new D.Bookmark({ id, children: kids })];
  }
  return new D.Paragraph({ heading: LEVELS[level], children: kids });
}

// ------------------------------------------------------------------------------------------------ blocks
function blocks(tokens, ctx) {
  const out = [];
  for (const t of tokens) {
    switch (t.type) {
      case 'space': break;
      case 'heading': {
        if (t.depth === 1 && ctx.dropFirstH1 && !ctx.droppedH1) { ctx.droppedH1 = true; break; }
        const lvl = Math.min(6, t.depth + ctx.shift);
        out.push(H(lvl, runs(t.tokens, ctx.rel), plain(t.tokens)));
        break;
      }
      case 'paragraph': out.push(new D.Paragraph({ children: runs(t.tokens, ctx.rel), ...(ctx.quote ? quoteProps() : {}) })); break;
      case 'list': out.push(...list(t, ctx, 0)); break;
      case 'table': out.push(table(t, ctx), new D.Paragraph({ spacing: { after: 60 }, children: [] })); break;
      case 'code': out.push(...code(t, ctx)); break;
      case 'blockquote': out.push(...blocks(t.tokens, { ...ctx, quote: true })); break;
      case 'hr': out.push(new D.Paragraph({ border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: RULE, space: 1 } }, spacing: { after: 160 }, children: [] })); break;
      case 'html': {
        const txt = unesc(t.text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).split(' ').map(x => x.trim()).filter(Boolean);
        for (const line of txt) out.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: line, size: 16, color: MUTED, italics: true })] }));
        break;
      }
      case 'text': out.push(new D.Paragraph({ children: runs(t.tokens || [t], ctx.rel) })); break;
      default:
        if (t.tokens) out.push(...blocks(t.tokens, ctx));
    }
  }
  return out;
}

function quoteProps() {
  return { indent: { left: 360 }, border: { left: { style: D.BorderStyle.SINGLE, size: 12, color: RULE, space: 8 } } };
}

function list(t, ctx, level) {
  const out = [];
  const ref = t.ordered ? 'numbers' : 'bullets';
  const instance = t.ordered ? ++numberingInstance : 0;
  for (const item of t.items) {
    let first = true;
    for (const sub of item.tokens) {
      if (sub.type === 'list') { out.push(...list(sub, ctx, Math.min(level + 1, 3))); continue; }
      if (sub.type === 'space') continue;
      if (sub.type === 'text' || sub.type === 'paragraph') {
        const kids = runs(sub.tokens || [sub], ctx.rel);
        if (item.task) kids.unshift(new D.TextRun({ text: item.checked ? '☑ ' : '☐ ' }));
        if (first) {
          out.push(new D.Paragraph({ numbering: { reference: ref, level, ...(t.ordered ? { instance } : {}) }, spacing: { after: 60 }, children: kids }));
          first = false;
        } else out.push(new D.Paragraph({ indent: { left: 720 + 360 * level }, spacing: { after: 60 }, children: kids }));
        continue;
      }
      out.push(...blocks([sub], ctx));
    }
  }
  return out;
}

function code(t, ctx) {
  if (t.lang === 'mermaid' && DIAGRAM && fs.existsSync(DIAGRAM)) {
    const png = fs.readFileSync(DIAGRAM);
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    const maxW = Math.floor(CONTENT_W / 15), scale = Math.min(1, maxW / w);
    return [new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 120, after: 160 },
      children: [new D.ImageRun({ type: 'png', data: png, transformation: { width: Math.round(w * scale), height: Math.round(h * scale) } })] })];
  }
  const lines = unesc(t.text).split('\n');
  const border = { style: D.BorderStyle.SINGLE, size: 4, color: 'E2DCCB', space: 4 };
  return lines.map((ln, i) => new D.Paragraph({
    shading: { type: D.ShadingType.CLEAR, fill: CODEBG, color: 'auto' },
    spacing: { before: i === 0 ? 80 : 0, after: i === lines.length - 1 ? 160 : 0, line: 240, lineRule: D.LineRuleType.AUTO },
    border: { left: border, right: border, ...(i === 0 ? { top: border } : {}), ...(i === lines.length - 1 ? { bottom: border } : {}) },
    indent: { left: 120, right: 120 },
    children: [new D.TextRun({ text: ln.length ? ln.replace(/\t/g, '    ') : ' ', font: MONO, size: 15, color: INK })],
  }));
}

function table(t, ctx) {
  const n = t.header.length;
  const lens = new Array(n).fill(4);
  const all = [t.header, ...t.rows];
  for (const row of all) row.forEach((c, i) => { lens[i] = Math.max(lens[i], Math.min(70, plain(c.tokens).length)); });
  const weights = lens.map(l => Math.sqrt(l) + 1.2);
  const sum = weights.reduce((a, b) => a + b, 0);
  let widths = weights.map(w => Math.max(1000, Math.round(CONTENT_W * w / sum)));
  const tot = widths.reduce((a, b) => a + b, 0);
  widths = widths.map(w => Math.floor(w * CONTENT_W / tot));
  widths[n - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  const size = n >= 6 ? 15 : n >= 4 ? 16 : 18;
  const cellBorder = { style: D.BorderStyle.SINGLE, size: 2, color: 'D9D2C0' };
  const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
  const align = a => a === 'right' ? D.AlignmentType.RIGHT : a === 'center' ? D.AlignmentType.CENTER : D.AlignmentType.LEFT;
  const emptyHeader = t.header.every(c => !plain(c.tokens).trim());
  const rows = [];
  if (!emptyHeader) rows.push(new D.TableRow({ tableHeader: true, cantSplit: true, children: t.header.map((c, i) => new D.TableCell({
    width: { size: widths[i], type: D.WidthType.DXA }, borders, shading: { type: D.ShadingType.CLEAR, fill: NAVY, color: 'auto' },
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new D.Paragraph({ alignment: align(t.align[i]), spacing: { after: 0 }, children: runs(c.tokens, ctx.rel, { bold: true, color: 'FFFFFF', size }) })],
  })) }));
  t.rows.forEach((row, r) => rows.push(new D.TableRow({ cantSplit: true, children: row.map((c, i) => new D.TableCell({
    width: { size: widths[i], type: D.WidthType.DXA }, borders,
    shading: { type: D.ShadingType.CLEAR, fill: r % 2 ? ZEBRA : 'FFFFFF', color: 'auto' },
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    children: [new D.Paragraph({ alignment: align(t.align[i]), spacing: { after: 0, line: 252, lineRule: D.LineRuleType.AUTO }, children: runs(c.tokens, ctx.rel, { size }) })],
  })) })));
  return new D.Table({ width: { size: CONTENT_W, type: D.WidthType.DXA }, columnWidths: widths, rows });
}

// ------------------------------------------------------------------------------------------------ chapters
function sourceLine(rel) {
  const d = changed(rel);
  return new D.Paragraph({ spacing: { after: 200 }, children: [
    new D.TextRun({ text: 'Source: ', size: 16, color: MUTED, italics: true }),
    new D.ExternalHyperlink({ link: GH + encodeURI(rel), children: [new D.TextRun({ text: rel, size: 16, color: '2B5A8C', font: MONO })] }),
    new D.TextRun({ text: d ? '  ·  last changed ' + d : '', size: 16, color: MUTED, italics: true }),
  ] });
}

function docChapter(rel, opt, partTitle, onlyDoc) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  // a plain text document is shown as it is, in the fixed-width font
  const md = rel.endsWith('.txt') ? '```text\n' + raw.replace(/```/g, "'''").replace(/\s+$/, '') + '\n```\n' : raw;
  const tokens = marked.lexer(md);
  const firstH1 = tokens.find(t => t.type === 'heading' && t.depth === 1);
  const title = opt.title || (firstH1 ? plain(firstH1.tokens) : path.basename(rel));
  const out = [];
  if (opt.keepH1) {
    out.push(...blocks(tokens, { rel, shift: 1, dropFirstH1: false }));
    return out;
  }
  // a chapter named like its Part (Architecture, Glossary…) goes straight under the Part's title
  if (!(onlyDoc && title.toLowerCase() === String(partTitle).toLowerCase())) out.push(H(2, [new D.TextRun(title)], title));
  if (!opt.noSource) out.push(sourceLine(rel));
  out.push(...blocks(tokens, { rel, shift: 1, dropFirstH1: true }));
  return out;
}

function partHeading(n, p) {
  const out = [
    new D.Paragraph({ pageBreakBefore: true, keepNext: true, spacing: { before: 0, after: 40 },
      children: [new D.TextRun({ text: `PART ${n}`, size: 19, color: BRASS, characterSpacing: 140 })] }),
    H(1, [new D.TextRun(p.title)], p.title),
  ];
  if (p.intro) out.push(new D.Paragraph({ spacing: { after: 280 }, children: [new D.TextRun({ text: p.intro, italics: true, color: MUTED, size: 21 })] }));
  return out;
}

function mdBlocks(md, rel, shift) { return blocks(marked.lexer(md), { rel: rel || 'docs/record/x.md', shift, dropFirstH1: false }); }

function generated(kind) {
  const out = [];
  if (kind === 'decisions') {
    out.push(H(2, [new D.TextRun('Working rules')], 'Working rules'));
    out.push(new D.Paragraph({ children: [new D.TextRun({ text: 'How every change to the projects is made, as agreed with the developer (from the repository’s CLAUDE.md).', italics: true, color: MUTED })] }));
    out.push(...mdBlocks(X.rules, 'CLAUDE.md', 1));
  }
  if (kind === 'legal') {
    for (const [title, md] of X.legal) {
      out.push(H(2, [new D.TextRun(title)], title));
      const tokens = marked.lexer(md).filter((t, i, a) => !(t.type === 'heading' && t.depth === 1 && a.findIndex(x => x.type === 'heading') === i));
      out.push(...blocks(tokens, { rel: X.legalSrc[title] || 'index.html', shift: 1, dropFirstH1: false }));
    }
  }
  if (kind === 'history') {
    const md = '| Date | Commit | Change |\n|---|---|---|\n' + X.log.map(([d, h, s]) => `| ${d} | \`${h}\` | ${s.replace(/\|/g, '/')} |`).join('\n');
    out.push(new D.Paragraph({ children: [new D.TextRun({ text: `${X.count} changes since the repository was created, the latest on ${X.date} (${X.commit}). Not listed: ${X.dataCount} daily data updates (asteroid data, astronaut photos and other automatic data refreshes) and the record's own rebuilds.`, italics: true, color: MUTED })] }));
    out.push(...mdBlocks(md, null, 1));
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ cover and control
function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1] + ' ' + d + ', ' + y;
}

function cover() {
  const band = (text, opts) => new D.Paragraph({ shading: { type: D.ShadingType.CLEAR, fill: NAVY, color: 'auto' }, indent: { left: -MARGIN, right: -MARGIN }, ...opts,
    children: text ? [new D.TextRun(text)] : [] });
  const p = (children, opts = {}) => new D.Paragraph({ ...opts, children });
  return [
    band('', { spacing: { before: 0, after: 0, line: 240, lineRule: D.LineRuleType.AUTO } }),
    new D.Paragraph({ shading: { type: D.ShadingType.CLEAR, fill: NAVY, color: 'auto' }, indent: { left: -MARGIN, right: -MARGIN }, spacing: { before: 0, after: 0 },
      children: [new D.TextRun({ text: '      NASA AND ESA DATA PROJECTS', color: 'C0A062', size: 22, characterSpacing: 120, font: SERIF })] }),
    band('', { spacing: { before: 0, after: 0, line: 900, lineRule: D.LineRuleType.AUTO } }),
    p([], { spacing: { before: 1400 } }),
    p([new D.TextRun({ text: 'PROJECT RECORD', color: BRASS, size: 22, characterSpacing: 160 })], { spacing: { after: 120 } }),
    p([new D.TextRun({ text: 'NASA and ESA Data Projects', color: NAVY, size: 64, font: SERIF })], { spacing: { after: 80 } }),
    p([new D.TextRun({ text: 'Learning and exploring with open data from NASA and ESA', color: MUTED, size: 26, italics: true })],
      { spacing: { after: 360 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: BRASS, space: 12 } } }),
    p([new D.TextRun({ text: 'Asteroid Tracker  ·  Image Explorer  ·  Mars Data', color: NAVY, size: 24, characterSpacing: 20 })], { spacing: { after: 1600 } }),
    p([new D.TextRun({ text: 'Edition', color: BRASS, size: 18, characterSpacing: 100, allCaps: true })], { spacing: { after: 40 } }),
    p([new D.TextRun({ text: `${longDate(X.date)}  ·  repository ${X.commit}  ·  ${X.count} recorded changes`, color: INK, size: 22 })], { spacing: { after: 280 } }),
    p([new D.TextRun({ text: 'Developer', color: BRASS, size: 18, characterSpacing: 100, allCaps: true })], { spacing: { after: 40 } }),
    p([new D.TextRun({ text: 'Malcolm Syme  ·  mcsyme11@gmail.com', color: INK, size: 22 })], { spacing: { after: 280 } }),
    p([new D.TextRun({ text: 'Prepared with', color: BRASS, size: 18, characterSpacing: 100, allCaps: true })], { spacing: { after: 40 } }),
    p([new D.TextRun({ text: 'Claude (Anthropic), from the project repository', color: INK, size: 22 })], { spacing: { after: 1200 } }),
    p([new D.TextRun({ text: '© 2026 Malcolm Syme. Released under the MIT License. Data courtesy of NASA and ESA; not endorsed by NASA or ESA.', color: MUTED, size: 16, italics: true })],
      { border: { top: { style: D.BorderStyle.SINGLE, size: 4, color: RULE, space: 8 } } }),
  ];
}

function titlePara(text, newPage) {
  return new D.Paragraph({ pageBreakBefore: newPage, spacing: { after: 240 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: BRASS, space: 10 } },
    children: [new D.TextRun({ text, font: SERIF, size: 44, color: NAVY })] });
}

function control() {
  // The record's own rebuilds ("Project Record rebuilt", with a note in brackets or "for …") are left out here; they'd
  // fill half the table. Repository History keeps every change.
  const recent = X.log.slice(0, 12);  // 12 keeps the table on the Document control page as long as no row runs past two lines
  // A description is shortened at a word boundary so its row stays within two lines (the full text is in Repository History).
  const briefChange = (s) => {
    const text = s.replace(/\|/g, '/');
    if (text.length <= 105) return text;
    const cut = text.slice(0, 103);
    return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:(]+$/, '') + ' …';
  };
  const md = [
    '| | |', '|---|---|',
    `| **Title** | NASA and ESA Data Projects: Project Record |`,
    `| **Edition** | ${longDate(X.date)}, built from repository commit \`${X.commit}\` |`,
    `| **Owner** | Malcolm Syme · mcsyme11@gmail.com |`,
    `| **Source** | The project repository on GitHub (mcsyme11-byte/NASA-ESA-Data-and-API-Projects), main branch |`,
    `| **How it is kept** | Rebuilt automatically on GitHub after every change to the repository, except the daily data updates (which change only data files, none of them in this record), and saved to the repository straight after, so each edition matches the repository at the commit it names |`,
    `| **Status** | Public project record (the repository is public) |`,
    '', '## Latest changes', '',
    'The twelve most recent changes in this edition, not counting the record\'s own rebuilds and the daily data updates, with long descriptions shortened; the full list is in Part ' + (PARTS.findIndex(p => p.generated === 'history') + 1) + ', Repository History.', '',
    '| Date | Commit | Change |', '|---|---|---|',
    ...recent.map(([d, h, s]) => `| ${d} | \`${h}\` | ${briefChange(s)} |`),
  ].join('\n');
  return [titlePara('Document control', false), ...blocks(marked.lexer(md), { rel: 'docs/record/control.md', shift: 1, dropFirstH1: false })];
}

// ------------------------------------------------------------------------------------------------ assemble
function body() {
  const out = [];
  PARTS.forEach((p, i) => {
    out.push(...partHeading(i + 1, p));
    if (p.generated) out.push(...generated(p.generated));
    for (const [rel, opt] of p.docs || []) out.push(...docChapter(rel, opt, p.title, p.docs.length === 1 && !p.generated));
  });
  return out;
}

// header and footer: text on the left, a right-aligned tab stop at the margin for the edition and the page number
const RIGHT_TAB = [{ type: D.TabStopType.RIGHT, position: CONTENT_W }];
const header = new D.Header({ children: [new D.Paragraph({ tabStops: RIGHT_TAB, border: { bottom: { style: D.BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } }, children: [
  new D.TextRun({ text: 'NASA AND ESA DATA PROJECTS  ·  PROJECT RECORD', size: 15, color: BRASS, characterSpacing: 40 }),
  new D.TextRun({ text: `\tEdition ${longDate(X.date)}`, size: 15, color: MUTED, italics: true }),
] })] });
const footerWith = pageRuns => new D.Footer({ children: [new D.Paragraph({ tabStops: RIGHT_TAB, border: { top: { style: D.BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } }, children: [
  new D.TextRun({ text: '\u00a9 2026 Malcolm Syme  ·  mcsyme11@gmail.com  ·  MIT License', size: 15, color: MUTED }),
  new D.TextRun({ children: ['\t', ...pageRuns], size: 15, color: MUTED }),
] })] });
// the front matter is numbered i, ii, iii…; the body 1, 2, 3…
const frontFooter = footerWith(['Page ', D.PageNumber.CURRENT]);
const footer = footerWith(['Page ', D.PageNumber.CURRENT]);

const heading = (id, size, color, opts = {}) => ({
  id, name: id.replace('Heading', 'Heading '), basedOn: 'Normal', next: 'Normal', quickFormat: true,
  run: { font: SERIF, size, color, bold: false, ...(opts.run || {}) },
  paragraph: { keepNext: true, keepLines: true, ...(opts.paragraph || {}) },
});
const bulletLevels = [0, 1, 2, 3].map(l => ({ level: l, format: D.LevelFormat.BULLET, text: ['•', '–', '◦', '•'][l], alignment: D.AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 360 + 360 * l, hanging: 260 } }, run: { color: BRASS } } }));
const numberLevels = [0, 1, 2, 3].map(l => ({ level: l, format: [D.LevelFormat.DECIMAL, D.LevelFormat.LOWER_LETTER, D.LevelFormat.LOWER_ROMAN, D.LevelFormat.DECIMAL][l],
  text: `%${l + 1}.`, alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 400 + 360 * l, hanging: 320 } } } }));

const BODY = body();
// the contents' right-hand page numbers sit at the right margin
D.TableOfContents.prototype.getTabStopsForLevel = function () { return [{ type: 'right', position: CONTENT_W, leader: 'dot' }]; };
function contents() {
  if (!TOC_PAGES) return new D.TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' });
  const pages = new Map(TOC_PAGES.map(e => [e.href, e.page]));
  const missing = HEADS.filter(h => !pages.has(h.href));
  if (missing.length) console.log('contents: no page found for ' + missing.length + ' heading(s), e.g. ' + missing[0].title);
  return new D.TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2', beginDirty: false,
    cachedEntries: HEADS.map(h => ({ title: h.title, level: h.level, href: h.href, page: pages.get(h.href) })) });
}

const doc = new D.Document({
  creator: 'Malcolm Syme', title: 'NASA and ESA Data Projects: Project Record', subject: 'NASA and ESA Data Projects', company: 'Malcolm Syme',
  description: `Built from the repository at ${X.commit} on ${X.date}. © 2026 Malcolm Syme · mcsyme11@gmail.com`,
  features: { updateFields: !TOC_PAGES },
  styles: {
    default: { document: { run: { font: SERIF, size: 20, color: INK }, paragraph: { spacing: { after: 120, line: 276, lineRule: D.LineRuleType.AUTO } } } },
    paragraphStyles: [
      heading('Heading1', 44, NAVY, { paragraph: { spacing: { before: 0, after: 200 }, outlineLevel: 0,
        border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: BRASS, space: 10 } } } }),
      heading('Heading2', 32, NAVY, { paragraph: { spacing: { before: 420, after: 100 }, outlineLevel: 1 } }),
      heading('Heading3', 25, '7A5F2C', { paragraph: { spacing: { before: 300, after: 80 }, outlineLevel: 2 } }),
      heading('Heading4', 22, NAVY, { run: { bold: true }, paragraph: { spacing: { before: 220, after: 60 }, outlineLevel: 3 } }),
      heading('Heading5', 20, NAVY2, { run: { bold: true, italics: true }, paragraph: { spacing: { before: 180, after: 40 }, outlineLevel: 4 } }),
      heading('Heading6', 20, MUTED, { run: { italics: true }, paragraph: { spacing: { before: 160, after: 40 }, outlineLevel: 5 } }),
      { id: 'TOC1', name: 'toc 1', basedOn: 'Normal', next: 'Normal', run: { font: SERIF, size: 21, bold: true, color: NAVY },
        paragraph: { spacing: { before: 200, after: 40 }, keepNext: true } },
      { id: 'TOC2', name: 'toc 2', basedOn: 'Normal', next: 'Normal', run: { font: SERIF, size: 19, color: INK },
        paragraph: { spacing: { before: 0, after: 20 }, indent: { left: 300 } } },
    ],
  },
  numbering: { config: [{ reference: 'bullets', levels: bulletLevels }, { reference: 'numbers', levels: numberLevels }] },
  sections: [
    { properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 0, bottom: MARGIN, left: MARGIN, right: MARGIN } } }, children: cover() },
    { properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 600, footer: 600 },
        pageNumbers: { start: 1, formatType: D.NumberFormat.LOWER_ROMAN } } },
      headers: { default: header }, footers: { default: frontFooter },
      children: [...control(),
        titlePara('Contents', true), contents()] },
    { properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 600, footer: 600 },
        pageNumbers: { start: 1, formatType: D.NumberFormat.DECIMAL } } },
      headers: { default: header }, footers: { default: footer }, children: BODY },
  ],
});

fs.writeFileSync(OUT + '.heads.json', JSON.stringify(HEADS));
D.Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('wrote ' + OUT + ' (' + Math.round(buf.length / 1024) + ' KB)'); });
