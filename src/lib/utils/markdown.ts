/**
 * Simple, secure client-side Markdown to HTML formatter for Notes & Descriptions.
 */

export function renderMarkdown(markdown: string): string {
  if (!markdown) return '<p class="text-zinc-500 italic">Sem conteúdo...</p>';

  // Basic HTML escaping
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-amber-400 mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-base font-bold text-amber-300 mt-3.5 mb-1.5 border-b border-zinc-800 pb-1">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-lg font-black text-amber-200 mt-4 mb-2 border-b border-zinc-700 pb-1.5">$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong class="text-amber-200"><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong class="text-zinc-100 font-bold">$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em class="text-zinc-300 italic">$1</em>');

  // Checklists
  html = html.replace(/^- \[x\] (.*$)/gim, '<div class="flex items-center gap-2 text-xs text-emerald-400 my-0.5 line-through opacity-80"><span class="w-3.5 h-3.5 rounded bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-[10px]">✓</span><span>$1</span></div>');
  html = html.replace(/^- \[ \] (.*$)/gim, '<div class="flex items-center gap-2 text-xs text-zinc-300 my-0.5"><span class="w-3.5 h-3.5 rounded bg-zinc-800 border border-zinc-600 flex items-center justify-center"></span><span>$1</span></div>');

  // Bullet Lists
  html = html.replace(/^- (.*$)/gim, '<li class="text-xs text-zinc-300 list-disc ml-4 my-0.5">$1</li>');
  html = html.replace(/^([0-9]+)\. (.*$)/gim, '<li class="text-xs text-zinc-300 list-decimal ml-4 my-0.5">$2</li>');

  // Blockquotes & Secrets
  html = html.replace(/^&gt; 🔒 (.*$)/gim, '<blockquote class="p-2.5 my-2 rounded-xl bg-rose-950/40 border-l-4 border-rose-500 text-xs text-rose-200 font-medium">$1</blockquote>');
  html = html.replace(/^&gt; (.*$)/gim, '<blockquote class="p-2.5 my-2 rounded-xl bg-zinc-950/80 border-l-4 border-amber-500/60 text-xs text-zinc-300 italic">$1</blockquote>');

  // Code / Handout Blocks
  html = html.replace(/```([\s\S]*?)```/gim, '<pre class="p-3 my-2 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-amber-300 overflow-x-auto"><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/gim, '<code class="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-amber-300">$1</code>');

  // Wikilinks: [[Target]] or [[Target|Alias]]
  html = html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => {
    const label = alias || target;
    const cleanTarget = target.trim();
    return `<span class="wikilink-pill inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-mono font-medium hover:bg-amber-500/25 transition cursor-pointer" data-target="${cleanTarget}">🔗 ${label.trim()}</span>`;
  });

  // Images: ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, (_, alt, src) => {
    const cleanSrc = src.replace(/&amp;/g, '&').trim();
    const caption = alt ? alt.trim() : '';
    const captionHtml = caption
      ? `<div class="px-3 py-1.5 text-[11px] text-zinc-400 bg-zinc-950/90 border-t border-zinc-800/80 italic truncate">${caption}</div>`
      : '';
    return `<div class="my-3 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-lg max-w-full"><img src="${cleanSrc}" alt="${caption}" class="w-full max-h-[500px] object-contain bg-zinc-950/60 block" loading="lazy" />${captionHtml}</div>`;
  });

  // Standard Links: [text](url)
  html = html.replace(/(?<!\!)\[([^\]]+)\]\(([^)]+)\)/gim, (_, text, href) => {
    const cleanHref = href.replace(/&amp;/g, '&').trim();
    return `<a href="${cleanHref}" target="_blank" rel="noopener noreferrer" class="text-amber-400 hover:text-amber-300 underline underline-offset-2">${text}</a>`;
  });

  // Linebreaks
  html = html.replace(/\n\n+/g, '<br/><br/>');
  html = html.replace(/(?<!<\/h1>|<\/h2>|<\/h3>|<\/blockquote>|<\/pre>|<\/li>)\n/g, '<br/>');

  return html;
}

/**
 * Replaces all occurrences of a wikilink target across a text string,
 * preserving any aliases and surrounding Markdown structure.
 * Matches case-insensitively and handles optional .md extensions.
 */
export function replaceWikilinkTarget(
  text: string,
  oldTarget: string,
  newTarget: string
): string {
  if (!text || !text.includes('[[')) return text;
  const cleanOld = oldTarget.trim();
  const cleanNew = newTarget.trim();
  if (!cleanOld || !cleanNew || cleanOld.toLowerCase() === cleanNew.toLowerCase()) {
    return text;
  }

  const oldLower = cleanOld.toLowerCase();

  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (fullMatch, target, alias) => {
    const t = target.trim().toLowerCase();
    const isMatch =
      t === oldLower ||
      t === `${oldLower}.md` ||
      (oldLower.endsWith('.md') && t === oldLower.replace(/\.md$/, '')) ||
      normalizeWikilinkTarget(t) === normalizeWikilinkTarget(cleanOld);

    if (isMatch) {
      if (alias !== undefined) {
        return `[[${cleanNew}|${alias}]]`;
      }
      return `[[${cleanNew}]]`;
    }
    return fullMatch;
  });
}

/**
 * Extracts all unique wikilink targets from a markdown string,
 * ignoring any pipe aliases and trimming whitespace.
 */
export function extractWikilinkTargets(content: string): string[] {
  if (!content || !content.includes('[[')) return [];
  const matches = Array.from(content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g));
  return matches.map((m) => m[1].trim()).filter(Boolean);
}

/**
 * Normalizes a wikilink target or node title for resilient comparison:
 * handles accents/diacritics, underscores, hyphens, .md suffixes and casing.
 * e.g. "[[Alberto_Gomes.md]]" matches "Alberto Gomes", and "[[otavio]]" matches "Otávio".
 */
export function normalizeWikilinkTarget(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/\.md$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-]+/g, ' ')
    .toLowerCase();
}

export interface MarkdownImage {
  alt: string;
  url: string;
}

/**
 * Extracts all images (![alt](url)) embedded inside markdown text.
 */
export function extractImagesFromMarkdown(markdown: string): MarkdownImage[] {
  if (!markdown || !markdown.includes('![')) return [];
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images: MarkdownImage[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    images.push({
      alt: match[1]?.trim() || '',
      url: match[2]?.replace(/&amp;/g, '&').trim() || '',
    });
  }
  return images;
}

/**
 * Strips markdown image tags from text to get a clean text-only description/summary
 * without displaying huge base64 strings or raw image syntax.
 */
export function stripImagesFromMarkdown(markdown: string): string {
  if (!markdown) return '';
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '').trim();
}

