// Server-side, dependency-free document renderer. Produces a standalone, print-optimised HTML page.
// Print it to PDF from the browser (A4, page numbers via @page). All text is HTML-escaped.

export type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "md"; text: string }
  | { type: "table"; head: string[]; rows: string[][]; right?: number[]; foot?: string[] }
  | { type: "kv"; rows: [string, string][] }
  | { type: "note"; text: string; tone?: "info" | "warn" }
  | { type: "signature"; parties: string[] }
  | { type: "pagebreak" };

export interface DocModel {
  title: string; subtitle?: string; watermark?: string; accent?: string; lang?: string;
  business: { name: string; email?: string; phone?: string; website?: string; address?: string; logoDataUrl?: string; registrationNumber?: string; taxNumber?: string };
  meta: [string, string][]; blocks: Block[]; footerNote?: string;
}

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const inline = (t: string) => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

/** Minimal markdown: paragraphs, "- " bullets, "1. " numbered lists, "### " sub-headings, **bold**. */
export function mdToHtml(md: string): string {
  const out: string[] = []; let list: "ul" | "ol" | null = null; let para: string[] = [];
  const flushP = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; } };
  const closeL = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    const ul = /^\s*[-*]\s+(.*)$/.exec(line); const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line); const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (!line.trim()) { flushP(); closeL(); continue; }
    if (h) { flushP(); closeL(); out.push(`<h4>${inline(h[1])}</h4>`); continue; }
    const want = ul ? "ul" : ol ? "ol" : null;
    if (want) { flushP(); if (list !== want) { closeL(); out.push(`<${want}>`); list = want; } out.push(`<li>${inline((ul ?? ol)![1])}</li>`); continue; }
    closeL(); para.push(line);
  }
  flushP(); closeL();
  return out.join("\n");
}

const CSS = (accent: string) => `
:root{--accent:${accent};--ink:#1b1b18;--muted:#5d5b53;--line:#d9d4c7;--bg:#fff}
@media (prefers-color-scheme:dark){:root{--ink:#ecebe6;--muted:#a9a79d;--line:#3a3934;--bg:#161614}}
@media print{:root{--ink:#1b1b18;--muted:#5d5b53;--line:#d9d4c7;--bg:#fff}.noprint{display:none!important}}
@page{size:A4;margin:18mm 16mm 20mm;@bottom-left{content:var(--footer-left);font-size:8pt;color:#666}@bottom-right{content:"Page " counter(page) " of " counter(pages);font-size:8pt;color:#666}}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:var(--bg);color:var(--ink);font:11pt/1.55 Georgia,"Times New Roman",serif}
.page{max-width:820px;margin:0 auto;padding:32px 28px}
header.top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:3px solid var(--accent);padding-bottom:14px;margin-bottom:22px}
.biz{font:600 10pt/1.4 system-ui,sans-serif}.biz img{max-height:54px;max-width:200px;display:block;margin-bottom:6px}.biz small{display:block;font-weight:400;color:var(--muted)}
h1{font:700 22pt/1.2 system-ui,sans-serif;margin:0 0 4px;color:var(--accent)}.sub{color:var(--muted);font:10.5pt system-ui,sans-serif}
h2{font:700 14pt system-ui,sans-serif;margin:26px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--line);color:var(--accent);break-after:avoid;page-break-after:avoid}
h3{font:700 11.5pt system-ui,sans-serif;margin:16px 0 6px;break-after:avoid}h4{font:700 10.5pt system-ui,sans-serif;margin:12px 0 4px}
p{margin:6px 0;orphans:3;widows:3}ul,ol{margin:6px 0 6px 20px;padding:0}li{margin:2px 0;break-inside:avoid}
table{width:100%;border-collapse:collapse;margin:10px 0;font:9.5pt/1.4 system-ui,sans-serif;break-inside:avoid;page-break-inside:avoid}
th{background:color-mix(in srgb,var(--accent) 12%,var(--bg));text-align:left}th,td{border:1px solid var(--line);padding:6px 8px;vertical-align:top}tr{break-inside:avoid}td.r,th.r{text-align:right;white-space:nowrap}
tfoot td{font-weight:700;background:color-mix(in srgb,var(--accent) 7%,var(--bg))}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px 24px;margin:0 0 18px;font:9.5pt system-ui,sans-serif}.meta div span{display:block;color:var(--muted);font-size:8pt;text-transform:uppercase;letter-spacing:.04em}
.note{border-left:4px solid var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--bg));padding:8px 12px;margin:12px 0;font:10pt system-ui,sans-serif;break-inside:avoid}.note.warn{border-color:#b45309;background:color-mix(in srgb,#b45309 10%,var(--bg))}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:28px;break-inside:avoid}.sig div{border-top:1px solid var(--ink);padding-top:6px;font:9.5pt system-ui,sans-serif;min-height:60px}
.wm{position:fixed;top:42%;left:0;right:0;text-align:center;font:800 64pt system-ui,sans-serif;color:rgba(120,120,120,.13);transform:rotate(-24deg);pointer-events:none;z-index:0}
footer{margin-top:32px;padding-top:10px;border-top:1px solid var(--line);color:var(--muted);font:8.5pt system-ui,sans-serif}
.bar{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:8px 16px;font:10pt system-ui,sans-serif;display:flex;gap:12px;align-items:center;z-index:5}.bar button{font:inherit;padding:6px 14px;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:6px;cursor:pointer}`;

function renderBlock(b: Block): string {
  switch (b.type) {
    case "h2": return `<h2>${esc(b.text)}</h2>`;
    case "h3": return `<h3>${esc(b.text)}</h3>`;
    case "md": return mdToHtml(b.text);
    case "note": return `<div class="note ${b.tone === "warn" ? "warn" : ""}">${inline(b.text)}</div>`;
    case "pagebreak": return `<div style="break-after:page"></div>`;
    case "kv": return `<table><tbody>${b.rows.map(([k, v]) => `<tr><th style="width:34%">${esc(k)}</th><td>${inline(v)}</td></tr>`).join("")}</tbody></table>`;
    case "signature": return `<div class="sig">${b.parties.map((p) => `<div>${esc(p)}<br><br>Name: ______________________<br>Date: ______________________</div>`).join("")}</div>`;
    case "table": {
      const r = new Set(b.right ?? []);
      return `<table><thead><tr>${b.head.map((h, i) => `<th class="${r.has(i) ? "r" : ""}">${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows.map((row) => `<tr>${row.map((c, i) => `<td class="${r.has(i) ? "r" : ""}">${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody>${b.foot ? `<tfoot><tr>${b.foot.map((c, i) => `<td class="${r.has(i) ? "r" : ""}">${esc(c)}</td>`).join("")}</tr></tfoot>` : ""}</table>`;
    }
  }
}

export function renderDocument(d: DocModel): string {
  const accent = /^#[0-9a-fA-F]{6}$/.test(d.accent ?? "") ? d.accent! : "#1f6b57";
  const biz = d.business;
  const bizLines = [biz.address, [biz.email, biz.phone].filter(Boolean).join(" · "), biz.website, biz.registrationNumber ? `Reg. no. ${biz.registrationNumber}` : "", biz.taxNumber ? `Tax no. ${biz.taxNumber}` : ""].filter(Boolean);
  const footerLeft = `${d.title}${d.meta.find(([k]) => k === "Reference") ? " · " + d.meta.find(([k]) => k === "Reference")![1] : ""}`.replace(/[^\p{L}\p{N} \-_.:·,]/gu, "");
  return `<!doctype html><html lang="${esc(d.lang ?? "en")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(d.title)}</title><style>:root{--footer-left:"${footerLeft}"}${CSS(accent)}</style></head><body>
<div class="bar noprint"><button onclick="window.print()">Print / Save as PDF</button><span>Tip: choose “Save as PDF”, A4, and turn on background graphics.</span></div>
${d.watermark ? `<div class="wm">${esc(d.watermark)}</div>` : ""}
<div class="page"><header class="top"><div><h1>${esc(d.title)}</h1>${d.subtitle ? `<div class="sub">${esc(d.subtitle)}</div>` : ""}</div>
<div class="biz">${biz.logoDataUrl && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(biz.logoDataUrl) ? `<img src="${biz.logoDataUrl}" alt="">` : ""}${esc(biz.name)}${bizLines.map((l) => `<small>${esc(l)}</small>`).join("")}</div></header>
<div class="meta">${d.meta.map(([k, v]) => `<div><span>${esc(k)}</span>${esc(v)}</div>`).join("")}</div>
${d.blocks.map(renderBlock).join("\n")}
<footer>${esc(d.footerNote ?? "")}${d.footerNote ? "<br>" : ""}Generated ${new Date().toISOString().slice(0, 10)}. This document reflects the terms of the version identified above.</footer></div></body></html>`;
}
