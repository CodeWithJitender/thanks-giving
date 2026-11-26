import * as XLSX from 'xlsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function formatClientName(raw = '') {
  const cleaned = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((word) =>
      word
        .split(/([-'])/)
        .map((part) => {
          if (part === '-' || part === "'" || !part) return part;
          const isAllLower = part === part.toLowerCase();
          const isAllUpper = part === part.toUpperCase();
          if (isAllLower || isAllUpper) {
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
          }
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join('')
    )
    .join(' ');
}

export function isValidEmail(email) {
  return EMAIL_REGEX.test(String(email || '').trim());
}

export function detectColumns(headers = []) {
  const lower = headers.map((h) => ({ raw: h, norm: String(h || '').trim().toLowerCase() }));

  const findMatch = (patterns) => {
    for (const p of patterns) {
      const exact = lower.find((h) => h.norm === p);
      if (exact) return exact.raw;
    }
    for (const p of patterns) {
      const partial = lower.find((h) => h.norm.includes(p));
      if (partial) return partial.raw;
    }
    return '';
  };

  return {
    nameCol: findMatch(['client name', 'full name', 'name', 'first name', 'contact name', 'client']),
    emailCol: findMatch(['email id', 'email address', 'e-mail', 'email', 'mail']),
    deptCol: findMatch(['department', 'dept', 'website name', 'lob', 'brand', 'line of business', 'division', 'team']),
  };
}

export async function parseSpreadsheetFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('The uploaded spreadsheet is empty.');
  }

  const headers = Object.keys(rawRows[0]);
  const mapping = detectColumns(headers);

  return {
    fileName: file.name,
    sheetName: firstSheetName,
    sheetNames: workbook.SheetNames,
    headers,
    rawRows,
    mapping,
  };
}

export function normalizeRows(rawRows, mapping) {
  const seenEmails = new Set();

  return rawRows.map((row, idx) => {
    const name = formatClientName(row[mapping.nameCol] ?? '');
    const email = String(row[mapping.emailCol] ?? '').trim();
    const department = String(row[mapping.deptCol] ?? '').trim();

    const emailLower = email.toLowerCase();
    const validEmail = isValidEmail(email);
    const isDuplicate = validEmail && seenEmails.has(emailLower);
    if (validEmail) seenEmails.add(emailLower);

    return {
      id: `row_${idx + 1}`,
      rowNumber: idx + 2,
      name,
      email,
      department,
      validEmail,
      isDuplicate,
      raw: row,
    };
  });
}

export function getSampleSpreadsheetRows() {
  return [
    { Name: 'Deeksha Sharma', 'Email ID': 'deeksha.sharma@example.com', Department: 'Head Field' },
    { Name: 'Aarav Mehta', 'Email ID': 'aarav.mehta@example.com', Department: 'Head Field' },
    { Name: 'Priya Nair', 'Email ID': 'priya.nair@example.com', Department: 'Glocal BPO' },
    { Name: 'Michael Carter', 'Email ID': 'm.carter@example.com', Department: 'Glocal Design' },
    { Name: 'Sophia Chen', 'Email ID': 'sophia.chen@example.com', Department: 'Glocal Codes' },
    { Name: 'Rohan Kapoor', 'Email ID': 'rohan.kapoor@example.com', Department: 'Glocal Accounting' },
    { Name: 'Elena Rodriguez', 'Email ID': 'elena.rodriguez@example.com', Department: 'HF Realtors' },
    { Name: 'David Kim', 'Email ID': 'david.kim@example.com', Department: 'Glocal Assist' },
    { Name: 'Invalid Client', 'Email ID': 'not-an-email', Department: 'Head Field' },
  ];
}

export function downloadSampleCsv() {
  const rows = getSampleSpreadsheetRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clients');
  XLSX.writeFile(wb, 'sample-thanksgiving-clients.csv');
}

export function exportCampaignCsv(campaign) {
  const rows = (campaign.results || []).map((r) => ({
    Name: r.name,
    Email: r.email,
    Department: r.department,
    TemplateUsed: r.templateUsed || '',
    Status: r.status,
    Error: r.error || '',
    PreviewURL: r.previewUrl || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DeliveryReport');
  XLSX.writeFile(wb, `${campaign.id}-report.csv`);
}
