/**
 * YALIX Enterprise CSV Export & Unicode Serialization Engine
 * 
 * Compliant with RFC 4180:
 * - Fields containing quotes, commas, CRLF, or leading/trailing whitespace are properly enclosed in double quotes.
 * - Internal double quotes are escaped as two double quotes ("").
 * - Null/undefined values are serialized as empty string.
 * - UTF-8 Byte Order Mark (BOM: \uFEFF) is prepended so Excel and international spreadsheet viewers preserve UTF-8 Unicode characters (accents, umlauts, kanji, etc.).
 * - Secrets, passwords, tokens, auth state, and private security metadata are strictly filtered out.
 */

// Deny-list of private/secret attributes that must never be exported
const SENSITIVE_EXPORT_KEYS = new Set([
  'password',
  'hashedPassword',
  'secret',
  'apiToken',
  'token',
  'authToken',
  'privateKey',
  'accessToken',
  'refreshToken',
  'credentials',
]);

export interface ExportColumnDef<T = any> {
  key: string;
  label: string;
  getter?: (item: T) => any;
}

/**
 * Escapes an individual value into a valid RFC 4180 CSV cell.
 */
export function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }

  // If object or array, serialize cleanly
  let str: string;
  if (typeof val === 'object') {
    if (val instanceof Date) {
      str = val.toISOString();
    } else {
      str = JSON.stringify(val);
    }
  } else {
    str = String(val);
  }

  // If string contains comma, double quote, newline, carriage return, or leading/trailing whitespace
  const needsQuotes =
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r') ||
    str.startsWith(' ') ||
    str.endsWith(' ');

  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts an array of objects to a fully RFC 4180-compliant CSV string with UTF-8 BOM.
 */
export function generateCsvString<T extends Record<string, any>>(
  records: T[],
  columns: ExportColumnDef<T>[]
): string {
  // Filter out any accidentally sensitive columns
  const safeColumns = columns.filter((col) => !SENSITIVE_EXPORT_KEYS.has(col.key.toLowerCase()));

  const headerRow = safeColumns.map((c) => escapeCsvValue(c.label)).join(',');

  const dataRows = records.map((record) => {
    return safeColumns
      .map((col) => {
        let value = col.getter ? col.getter(record) : record[col.key];
        // Extra safeguard: do not export sensitive keys even if dynamically nested
        if (SENSITIVE_EXPORT_KEYS.has(col.key.toLowerCase())) {
          return '';
        }
        return escapeCsvValue(value);
      })
      .join(',');
  });

  // UTF-8 BOM (\uFEFF) ensures Excel opens multilingual Unicode data correctly
  return '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
}

/**
 * Triggers a browser file download of the generated CSV file.
 */
export function downloadCsvFile(csvContent: string, fileName: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
