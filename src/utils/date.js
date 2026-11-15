/**
 * Date formatting utilities for Kesharkali
 * Formats all dates consistently to DD/MM/YYYY as required across the app.
 */

export function formatDateDMY(dateVal, fallback = '—') {
  if (!dateVal) return fallback;
  const s = String(dateVal).trim();
  if (!s || s === 'null' || s === 'undefined' || s === 'N/A' || s === '—') return fallback;

  // If already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  // Handle YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    return `${dd}/${mm}/${yyyy}`;
  }

  // Fallback to JS Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return s;
}

export default formatDateDMY;
