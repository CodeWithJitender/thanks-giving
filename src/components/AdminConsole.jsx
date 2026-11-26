import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Code2,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  FileSpreadsheet,
  Image as ImageIcon,
  Copy,
} from 'lucide-react';
import { api } from '../api';
import {
  detectColumns,
  downloadSampleCsv,
  formatClientName,
  getSampleSpreadsheetRows,
  isValidEmail,
  normalizeRows,
  parseSpreadsheetFile,
  exportCampaignCsv,
} from '../utils/spreadsheet';

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminConsole() {
  const [section, setSection] = useState('sheets'); // 'sheets' | 'templates' | 'campaigns' | 'assets'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importMode, setImportMode] = useState('merge'); // 'merge' | 'replace'
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const [data, setData] = useState({
    templates: [],
    sheets: [],
    campaigns: [],
    assets: [],
    sentHistory: [],
  });

  // Active sheet document being edited
  const [sheetRows, setSheetRows] = useState([]);
  const [sheetMeta, setSheetMeta] = useState({
    key: 'current',
    fileName: 'admin-sheet.xlsx',
    headers: ['Name', 'Email ID', 'Department'],
    mapping: { nameCol: 'Name', emailCol: 'Email ID', deptCol: 'Department' },
    selectedIds: [],
  });

  // Raw JSON Editor Modal
  const [jsonModal, setJsonModal] = useState(null); // { collection, text }

  const notify = useCallback((message, type = 'info') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminDocs();
      setData({
        templates: res.templates || [],
        sheets: res.sheets || [],
        campaigns: res.campaigns || [],
        assets: res.assets || [],
        sentHistory: res.sentHistory || [],
      });

      const currentSheet = (res.sheets || []).find((s) => s.key === 'current') || res.sheets?.[0];
      if (currentSheet) {
        setSheetMeta({
          key: currentSheet.key || 'current',
          fileName: currentSheet.fileName || 'uploaded-sheet.csv',
          headers: currentSheet.headers || ['Name', 'Email ID', 'Department'],
          mapping: currentSheet.mapping || {
            nameCol: 'Name',
            emailCol: 'Email ID',
            deptCol: 'Department',
          },
          selectedIds: currentSheet.selectedIds || [],
        });
        setSheetRows(currentSheet.rows || []);
      } else {
        setSheetRows([]);
      }
    } catch (err) {
      notify(`Failed to load MongoDB documents: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---------------- Export All / Individual ----------------
  const handleExportAllJson = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`thanksgiving-mongodb-backup-${date}.json`, {
      exportedAt: new Date().toISOString(),
      templates: data.templates,
      sheets: data.sheets,
      campaigns: data.campaigns,
    });
    notify('Exported full MongoDB backup JSON', 'success');
  };

  const handleExportSheet = (format) => {
    if (format === 'json') {
      downloadJson('clients-sheet.json', { ...sheetMeta, rows: sheetRows });
      return;
    }
    const exportRows = sheetRows.map((r) => ({
      Name: r.name,
      'Email ID': r.email,
      Department: r.department,
      ValidEmail: r.validEmail ? 'Yes' : 'No',
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, format === 'csv' ? 'clients-sheet.csv' : 'clients-sheet.xlsx');
    notify(`Exported ${sheetRows.length} client rows as ${format.toUpperCase()}`, 'success');
  };

  // ---------------- Import JSON Backup or Spreadsheet ----------------
  const handleImportJson = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = {
        mode: importMode,
        templates: Array.isArray(parsed.templates) ? parsed.templates : undefined,
        sheets: Array.isArray(parsed.sheets) ? parsed.sheets : undefined,
        campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : undefined,
      };
      if (!payload.templates && !payload.sheets && !payload.campaigns) {
        throw new Error('JSON must contain templates, sheets, or campaigns arrays');
      }
      const res = await api.importAdminDocs(payload);
      notify(
        `Imported (${importMode}): ${res.imported.templates} templates, ${res.imported.sheets} sheets, ${res.imported.campaigns} campaigns`,
        'success'
      );
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleImportSpreadsheet = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseSpreadsheetFile(file);
      const normalized = normalizeRows(parsed.rawRows, parsed.mapping).map(({ raw: _r, ...rest }) => rest);
      const nextRows =
        importMode === 'replace'
          ? normalized
          : [
              ...sheetRows,
              ...normalized.map((r, idx) => ({
                ...r,
                id: `row_${Date.now()}_${idx}`,
              })),
            ];
      setSheetRows(nextRows);
      setSheetMeta((m) => ({
        ...m,
        fileName: parsed.fileName,
        headers: parsed.headers,
        mapping: parsed.mapping,
        selectedIds: nextRows.filter((r) => r.validEmail).map((r) => r.id),
      }));
      notify(`Loaded ${normalized.length} rows from ${parsed.fileName} — click Save Sheet to MongoDB`, 'info');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  // ---------------- Sheet Row Manipulations ----------------
  const addBlankRow = () => {
    const newRow = {
      id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      rowNumber: sheetRows.length + 2,
      name: '',
      email: '',
      department: data.templates[0]?.department || 'Head Field',
      validEmail: false,
      isDuplicate: false,
    };
    setSheetRows((prev) => [newRow, ...prev]);
  };

  const updateRowField = (id, field, value) => {
    setSheetRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'email') {
          updated.validEmail = isValidEmail(value);
        }
        return updated;
      })
    );
  };

  const deleteRow = (id) => {
    setSheetRows((prev) => prev.filter((r) => r.id !== id));
  };

  const capitalizeAllNames = () => {
    setSheetRows((prev) => prev.map((r) => ({ ...r, name: formatClientName(r.name) })));
    notify('Capitalized all client names', 'info');
  };

  const removeDuplicateEmails = () => {
    const seen = new Set();
    const deduped = [];
    for (const r of sheetRows) {
      const key = String(r.email || '').trim().toLowerCase();
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      deduped.push({ ...r, isDuplicate: false });
    }
    const removed = sheetRows.length - deduped.length;
    setSheetRows(deduped);
    notify(`Removed ${removed} duplicate row(s)`, 'info');
  };

  const handleLoadSampleSheet = async () => {
    setSaving(true);
    try {
      const sampleRaw = getSampleSpreadsheetRows();
      const sampleHeaders = Object.keys(sampleRaw[0]);
      const sampleMapping = detectColumns(sampleHeaders);
      const normalized = normalizeRows(sampleRaw, sampleMapping).map(({ raw: _r, ...rest }) => rest);
      await api.saveSheet({
        fileName: 'sample-thanksgiving-clients.csv',
        headers: sampleHeaders,
        rawRows: sampleRaw,
        mapping: sampleMapping,
        rows: normalized,
        selectedIds: [],
      });
      notify(`Loaded and saved ${normalized.length} sample rows on server`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClearSheetOnServer = async () => {
    if (!window.confirm('Clear the uploaded client sheet from the server?')) return;
    setSaving(true);
    try {
      await api.clearSheet();
      setSheetRows([]);
      notify('Cleared saved client sheet from server', 'info');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSentHistoryItem = async (id) => {
    try {
      if (id) {
        const res = await fetch(`/api/sent-history?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete history entry');
      } else {
        if (!window.confirm('Clear all sent history records from the server?')) return;
        await api.clearSentHistory();
      }
      notify(id ? 'Deleted sent history record' : 'Cleared all sent history', 'info');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const saveSheetToMongo = async () => {
    setSaving(true);
    try {
      const cleanedRows = sheetRows.map((r) => ({
        ...r,
        name: formatClientName(r.name),
        email: String(r.email || '').trim(),
        validEmail: isValidEmail(r.email),
      }));
      await api.saveAdminDoc('sheets', {
        ...sheetMeta,
        rows: cleanedRows,
        selectedIds: cleanedRows.filter((r) => r.validEmail).map((r) => r.id),
      });
      setSheetRows(cleanedRows);
      notify(`Saved ${cleanedRows.length} client rows to MongoDB`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---------------- Template & Campaign Actions ----------------
  const saveRawJsonDoc = async () => {
    if (!jsonModal) return;
    setSaving(true);
    try {
      const parsed = JSON.parse(jsonModal.text);
      await api.saveAdminDoc(jsonModal.collection, parsed);
      setJsonModal(null);
      notify(`Saved ${jsonModal.collection} document to MongoDB`, 'success');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteDocument = async (collection, id) => {
    const label = collection === 'assets' ? `image "${id}"` : `this document from "${collection}"`;
    if (!window.confirm(`Delete ${label}?`)) return;
    try {
      await api.deleteAdminDoc(collection, id);
      notify(collection === 'assets' ? `Deleted image "${id}"` : 'Document deleted from MongoDB', 'info');
      await loadAll();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const filteredSheetRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sheetRows;
    return sheetRows.filter(
      (r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.department || '').toLowerCase().includes(q)
    );
  }, [sheetRows, search]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-900 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Main App
            </a>
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                <h1 className="text-sm font-bold tracking-tight">
                  Admin Document Console <span className="font-mono text-amber-400">/admin/jkr19</span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-400">
                Edit, manipulate, export, and import all uploaded documents in MongoDB Atlas
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Import Mode"
              value={importMode}
              onChange={(e) => setImportMode(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="merge">Import Mode: Merge</option>
              <option value="replace">Import Mode: Replace All</option>
            </select>

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700">
              <Upload className="h-3.5 w-3.5 text-amber-400" />
              Import JSON
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>

            <button
              type="button"
              onClick={handleExportAllJson}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Download className="h-3.5 w-3.5" />
              Export All (JSON)
            </button>

            <button
              type="button"
              onClick={loadAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav className="-mb-px flex gap-2 overflow-x-auto">
            {[
              { id: 'sheets', label: `Client Sheet Rows (${sheetRows.length})` },
              { id: 'templates', label: `Brand Templates (${data.templates.length})` },
              { id: 'campaigns', label: `Campaign Logs (${data.campaigns.length})` },
              { id: 'sentHistory', label: `Sent History (${data.sentHistory.length})` },
              { id: 'assets', label: `Uploaded Images (${data.assets.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSection(t.id)}
                className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
                  section === t.id
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Loading documents from MongoDB...
          </div>
        ) : (
          <>
            {/* 1. CLIENT SHEET DOCUMENTS */}
            {section === 'sheets' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter rows..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-52 rounded-lg border border-slate-300 py-1.5 pr-3 pl-8 text-xs focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addBlankRow}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Row
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" />
                      Import CSV / Excel
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleImportSpreadsheet}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={capitalizeAllNames}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      Capitalize Names
                    </button>
                    <button
                      type="button"
                      onClick={removeDuplicateEmails}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Deduplicate
                    </button>
                    <button
                      type="button"
                      onClick={downloadSampleCsv}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Sample CSV
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleLoadSampleSheet}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    >
                      Load Sample Data
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleClearSheetOnServer}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear Sheet
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportSheet('xlsx')}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Export .xlsx
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportSheet('csv')}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Export .csv
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportSheet('json')}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Export .json
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={saveSheetToMongo}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saving ? 'Saving...' : 'Save Sheet to MongoDB'}
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="max-h-[560px] overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                        <tr>
                          <th className="px-3 py-2.5">#</th>
                          <th className="px-3 py-2.5">Client Name</th>
                          <th className="px-3 py-2.5">Email ID</th>
                          <th className="px-3 py-2.5">Department</th>
                          <th className="px-3 py-2.5">Valid</th>
                          <th className="px-3 py-2.5 text-right">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSheetRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                              No client rows in MongoDB yet. Click &ldquo;Add Row&rdquo; or &ldquo;Import CSV / Excel&rdquo;.
                            </td>
                          </tr>
                        ) : (
                          filteredSheetRows.slice(0, 500).map((row, idx) => (
                            <tr key={row.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={row.name || ''}
                                  onChange={(e) => updateRowField(row.id, 'name', e.target.value)}
                                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-amber-500 focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={row.email || ''}
                                  onChange={(e) => updateRowField(row.id, 'email', e.target.value)}
                                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-amber-500 focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={row.department || ''}
                                  onChange={(e) =>
                                    updateRowField(row.id, 'department', e.target.value)
                                  }
                                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-amber-500 focus:outline-none"
                                />
                              </td>
                              <td className="px-3 py-2">
                                {isValidEmail(row.email) ? (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                    Valid
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                    Invalid
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => deleteRow(row.id)}
                                  className="rounded p-1 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. BRAND TEMPLATES */}
            {section === 'templates' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs text-slate-600">
                    Manage all MongoDB documents in <code className="font-mono">thanksgiving.templates</code>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setJsonModal({
                          collection: 'templates',
                          text: JSON.stringify(
                            {
                              id: `brand-${Date.now()}`,
                              department: 'New Brand',
                              fromName: 'New Brand',
                              fromEmail: '',
                              subject: 'Happy Thanksgiving, {{name}}!',
                              greeting: 'Dear {{name}},',
                              body: 'Wishing you a wonderful Thanksgiving!',
                              logoUrl: data.templates[0]?.logoUrl || '',
                              logoWidth: 220,
                              logoBgColor: '#ffffff',
                              posterUrl: data.templates[0]?.posterUrl || '',
                              isDefault: false,
                            },
                            null,
                            2
                          ),
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New Template Document
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadJson('brand-templates.json', data.templates)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export JSON
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data.templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900">{tpl.department}</span>
                          <span className="font-mono text-[10px] text-slate-400">{tpl.id}</span>
                        </div>
                        {tpl.logoUrl && (
                          <img
                            src={tpl.logoUrl}
                            alt={tpl.department}
                            style={{ backgroundColor: tpl.logoBgColor || '#ffffff' }}
                            className="h-12 w-full rounded-lg border border-slate-200 object-contain p-1.5"
                          />
                        )}
                        <div className="text-xs text-slate-600 truncate">
                          <span className="font-semibold">Subject:</span> {tpl.subject}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          <span className="font-semibold">From:</span> {tpl.fromName || tpl.department}{' '}
                          {tpl.fromEmail ? `<${tpl.fromEmail}>` : ''}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() =>
                            setJsonModal({
                              collection: 'templates',
                              text: JSON.stringify(tpl, null, 2),
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Code2 className="h-3.5 w-3.5" />
                          Edit JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDocument('templates', tpl.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. CAMPAIGN LOGS */}
            {section === 'campaigns' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs text-slate-600">
                    All campaign delivery documents stored in <code className="font-mono">thanksgiving.campaigns</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadJson('campaign-logs.json', data.campaigns)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Logs JSON
                  </button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Campaign</th>
                        <th className="px-4 py-3">Sent / Failed / Total</th>
                        <th className="px-4 py-3">Updated</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.campaigns.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                            No campaigns recorded yet.
                          </td>
                        </tr>
                      ) : (
                        data.campaigns.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-slate-900">{c.name}</td>
                            <td className="px-4 py-3">
                              <span className="text-emerald-700 font-semibold">{c.sent} sent</span> &bull;{' '}
                              <span className="text-red-600 font-semibold">{c.failed} failed</span> &bull;{' '}
                              {c.total} total
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-right space-x-1.5">
                              <button
                                type="button"
                                onClick={() => exportCampaignCsv(c)}
                                className="rounded border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                              >
                                CSV
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setJsonModal({
                                    collection: 'campaigns',
                                    text: JSON.stringify(c, null, 2),
                                  })
                                }
                                className="rounded border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Edit JSON
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteDocument('campaigns', c.id)}
                                className="rounded border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. SENT HISTORY */}
            {section === 'sentHistory' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs text-slate-600">
                    All sent email records &amp; images saved in <code className="font-mono">thanksgiving.sent_history</code>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => downloadJson('sent-history.json', data.sentHistory)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export JSON
                    </button>
                    {data.sentHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSentHistoryItem(null)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear All History
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Client</th>
                        <th className="px-4 py-3">Template / Dept</th>
                        <th className="px-4 py-3">Images Sent</th>
                        <th className="px-4 py-3">Sent At</th>
                        <th className="px-4 py-3 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.sentHistory.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                            No sent history recorded yet.
                          </td>
                        </tr>
                      ) : (
                        data.sentHistory.map((h, idx) => (
                          <tr key={h.id || `${h.email}-${idx}`} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{h.name || '—'}</div>
                              <div className="text-[11px] text-slate-500">{h.displayEmail || h.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800">{h.templateUsed || '—'}</div>
                              <div className="text-[11px] text-slate-400">Dept: {h.department || '—'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {h.logoUrl && (
                                  <img src={h.logoUrl} alt="Logo" className="h-6 w-12 rounded border border-slate-200 object-contain p-0.5" />
                                )}
                                {h.posterUrl && (
                                  <img src={h.posterUrl} alt="Poster" className="h-8 w-8 rounded border border-slate-200 object-cover" />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {h.sentAt ? new Date(h.sentAt).toLocaleString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {h.id && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSentHistoryItem(h.id)}
                                  className="rounded border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. UPLOADED IMAGE ASSETS */}
            {section === 'assets' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs text-slate-600">
                    All uploaded logos &amp; posters ({data.assets.length} files). Deleting an image removes it from disk and MongoDB.
                  </div>
                  <div className="relative">
                    <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter images..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-52 rounded-lg border border-slate-300 py-1.5 pr-3 pl-8 text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {data.assets
                    .filter((a) => !search.trim() || a.name.toLowerCase().includes(search.trim().toLowerCase()))
                    .map((a) => (
                      <div
                        key={a.name}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-xs"
                      >
                        <div className="mb-2 flex h-24 items-center justify-center rounded-lg bg-slate-50 p-2">
                          <img
                            src={a.url}
                            alt={a.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="truncate font-mono text-[11px] font-medium text-slate-800">
                          {a.name}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                          <span>{(a.size / 1024).toFixed(1)} KB</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(a.url);
                              notify(`Copied ${a.url}`, 'info');
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-amber-700 hover:underline"
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteDocument('assets', a.name)}
                          className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete Image
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Raw JSON Editor Modal */}
      {jsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Edit Document JSON ({jsonModal.collection})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setJsonModal(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              rows={18}
              value={jsonModal.text}
              onChange={(e) => setJsonModal({ ...jsonModal, text: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-emerald-300 focus:border-amber-500 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setJsonModal(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveRawJsonDoc}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save to MongoDB'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed right-5 bottom-5 z-50 flex max-w-md items-center gap-2.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl">
          {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
          {toast.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />}
          {toast.type === 'info' && <Info className="h-4 w-4 shrink-0 text-amber-400" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
