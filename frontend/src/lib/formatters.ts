/**
 * Helper utilities for formatting display text across the application.
 */

/**
 * Shortens a document/PDF filename for clean UI display:
 * 1. Strips the redundant .pdf extension
 * 2. If maxLen is provided and text exceeds maxLen, truncates with ellipsis
 * Example: "MACHINE-LEARNING-SHORT--NOTES-GFG_compressed.pdf" -> "MACHINE-LEARNING-SHOR…"
 */
export function formatDocName(name?: string | null, maxLen = 22): string {
  if (!name) return '';
  const clean = name.replace(/\.pdf$/i, '').trim();
  if (clean.length > maxLen) {
    return clean.slice(0, maxLen).trim() + '…';
  }
  return clean;
}

/**
 * Replaces [S1], [S2] citation format with simple bold numbers like **1.**, **2.**
 * Also ensures source listings under "Sources:" use bold numbers like **1.**
 */
export function formatCitationNumbers(text?: string | null): string {
  if (!text) return '';
  // Convert [S1][S2] -> **1.** **2.**
  let res = text.replace(/\[S(\d+)\](?=\[S\d+\])/gi, '**$1.** ');
  // Convert [S1] -> **1.**
  res = res.replace(/\[S(\d+)\]/gi, '**$1.**');
  
  // Under Sources: section, ensure lines starting with "1. " become bold "**1.** "
  res = res.replace(/(?:^|\n)Sources:\s*\n[\s\S]*?(?=(?:\n\s*\n|\nFollow-up|\Z))/gi, (block) => {
    return block.replace(/^(\s*)(\d+)\.\s*(?!\*)/gm, '$1**$2.** ');
  });
  return res;
}

