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

  // Linebreaks
  html = html.replace(/\n\n+/g, '<br/><br/>');
  html = html.replace(/(?<!<\/h1>|<\/h2>|<\/h3>|<\/blockquote>|<\/pre>|<\/li>)\n/g, '<br/>');

  return html;
}
