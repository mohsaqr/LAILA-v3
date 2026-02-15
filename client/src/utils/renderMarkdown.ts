/**
 * Simple markdown to HTML converter.
 * Handles: headers, bold, italic, code blocks, inline code, links, lists, line breaks.
 */
export function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code>$2</code></pre>')
    // Inline code
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
    // Numbered lists
    .replace(/^\d+\.\s+(.*$)/gm, '<li class="ml-4 list-decimal">$1</li>')
    // Bullet lists
    .replace(/^\s*[-*]\s+(.*$)/gm, '<li class="ml-4">$1</li>')
    // Paragraphs and line breaks
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/\n/g, '<br/>');

  // Wrap in paragraph if not starting with special element
  if (!html.startsWith('<h') && !html.startsWith('<pre') && !html.startsWith('<li')) {
    html = '<p class="mb-4">' + html + '</p>';
  }

  // Wrap consecutive list items
  html = html.replace(/(<li[^>]*>.*?<\/li>(<br\/>)?)+/g, '<ul class="list-disc mb-4">$&</ul>');

  return html;
}
