import React, { useEffect, useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Search,
  Send,
  Eye,
  X,
  PlusCircle,
  CheckCircle2,
  XCircle,
  StopCircle,
  RefreshCw,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../api';
import {
  detectColumns,
  downloadSampleCsv,
  exportCampaignCsv,
  getSampleSpreadsheetRows,
  normalizeRows,
  parseSpreadsheetFile,
} from '../utils/spreadsheet';
import EmailPreviewPane from './EmailPreviewPane';

const PAGE_SIZE = 50;

export default function SpreadsheetTab({
  templates,
  smtpConfig,
  sheetState,
  setSheetState,
  activeCampaign,
  setActiveCampaign,
  onCreateMissingTemplate,
  notify,
}) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [previewData, setPreviewData] = useState(null);
  const [sending, setSending] = useState(false);
  const [templateOfTheDayId, setTemplateOfTheDayId] = useState('auto');

  // Per-send / per-mail optional subject & description customization
  const [showCustomMail, setShowCustomMail] = useState(false);
  const [subjectOverride, setSubjectOverride] = useState('');
  const [bodyOverride, setBodyOverride] = useState('');
  const [rowOverrides, setRowOverrides] = useState({});

  const { fileName, headers, rawRows, mapping, rows, selectedIds } = sheetState;

  // Poll active campaign while running
  useEffect(() => {
    if (!activeCampaign || activeCampaign.status !== 'running') return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const res = await api.getCampaign(activeCampaign.id);
        if (active) setActiveCampaign(res.campaign);
      } catch {
        // Ignore transient poll error
      }
    }, 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [activeCampaign?.id, activeCampaign?.status, setActiveCampaign]);

  const templateMap = useMemo(() => {
    const map = new Map();
    for (const t of templates) {
      map.set((t.department || '').trim().toLowerCase(), t);
    }
    return map;
  }, [templates]);

  const defaultTemplate = useMemo(
    () => templates.find((t) => t.isDefault) || templates[0] || null,
    [templates]
  );

  const selectedDayTemplate = useMemo(
    () =>
      templateOfTheDayId === 'auto'
        ? null
        : templates.find((t) => t.id === templateOfTheDayId) || null,
    [templates, templateOfTheDayId]
  );

  const resolveTemplate = (dept) => {
    if (selectedDayTemplate) return selectedDayTemplate;
    const key = (dept || '').trim().toLowerCase();
    return templateMap.get(key) || defaultTemplate;
  };

  const hasExactTemplate = (dept) => {
    const key = (dept || '').trim().toLowerCase();
    return templateMap.has(key);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    try {
      const parsed = await parseSpreadsheetFile(file);
      const normalized = normalizeRows(parsed.rawRows, parsed.mapping);
      const defaultSelected = new Set(
        normalized.filter((r) => r.validEmail && !r.isDuplicate).map((r) => r.id)
      );
      setSheetState({
        fileName: parsed.fileName,
        headers: parsed.headers,
        rawRows: parsed.rawRows,
        mapping: parsed.mapping,
        rows: normalized,
        selectedIds: defaultSelected,
      });
      setRowOverrides({});
      setPage(1);
      setDeptFilter('ALL');
      notify(`Loaded ${normalized.length} clients from ${parsed.fileName}`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleLoadSample = () => {
    const sampleRaw = getSampleSpreadsheetRows();
    const sampleHeaders = Object.keys(sampleRaw[0]);
    const sampleMapping = detectColumns(sampleHeaders);
    const normalized = normalizeRows(sampleRaw, sampleMapping);
    const defaultSelected = new Set(
      normalized.filter((r) => r.validEmail && !r.isDuplicate).map((r) => r.id)
    );
    setSheetState({
      fileName: 'sample-thanksgiving-clients.csv',
      headers: sampleHeaders,
      rawRows: sampleRaw,
      mapping: sampleMapping,
      rows: normalized,
      selectedIds: defaultSelected,
    });
    setRowOverrides({});
    setPage(1);
    setDeptFilter('ALL');
    notify('Loaded sample spreadsheet', 'info');
  };

  const updateMapping = (key, value) => {
    const newMapping = { ...mapping, [key]: value };
    const normalized = normalizeRows(rawRows, newMapping);
    const defaultSelected = new Set(
      normalized.filter((r) => r.validEmail && !r.isDuplicate).map((r) => r.id)
    );
    setSheetState({
      ...sheetState,
      mapping: newMapping,
      rows: normalized,
      selectedIds: defaultSelected,
    });
    setPage(1);
  };

  const departments = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const dept = r.department || 'Unspecified';
      if (!map.has(dept)) {
        map.set(dept, {
          department: dept,
          count: 0,
          exact: hasExactTemplate(dept),
        });
      }
      map.get(dept).count++;
    }
    return Array.from(map.values());
  }, [rows, templateMap]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (deptFilter !== 'ALL' && (r.department || 'Unspecified') !== deptFilter) return false;
      if (q) {
        return (
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, deptFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleRow = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSheetState({ ...sheetState, selectedIds: next });
  };

  const selectAllFiltered = (select) => {
    const next = new Set(selectedIds);
    for (const r of filteredRows) {
      if (!r.validEmail) continue;
      if (select) next.add(r.id);
      else next.delete(r.id);
    }
    setSheetState({ ...sheetState, selectedIds: next });
  };

  const selectedRecipients = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id) && r.validEmail),
    [rows, selectedIds]
  );

  const handleSend = async () => {
    if (selectedRecipients.length === 0) return;
    setSending(true);
    try {
      const res = await api.startCampaign({
        recipients: selectedRecipients.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          department: r.department,
          subjectOverride: rowOverrides[r.id]?.subject || '',
          bodyOverride: rowOverrides[r.id]?.body || '',
        })),
        useDefaultFallback: true,
        selectedTemplateId: templateOfTheDayId,
        subjectOverride: subjectOverride.trim(),
        bodyOverride: bodyOverride.trim(),
        campaignName: `${fileName || 'Clients'} (${selectedRecipients.length})`,
      });
      setActiveCampaign(res.campaign);
      notify(`Sending started for ${selectedRecipients.length} clients!`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async () => {
    if (!activeCampaign) return;
    try {
      const res = await api.cancelCampaign(activeCampaign.id);
      setActiveCampaign(res.campaign);
      notify('Sending stopped', 'info');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleRetry = async () => {
    if (!activeCampaign) return;
    try {
      const res = await api.retryCampaign(activeCampaign.id);
      setActiveCampaign(res.campaign);
      notify('Retrying failed emails...', 'info');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const processed =
    (activeCampaign?.sent || 0) +
    (activeCampaign?.failed || 0) +
    (activeCampaign?.skipped || 0);
  const progressPct = activeCampaign?.total
    ? Math.round((processed / activeCampaign.total) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* 1. Simple Upload Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Upload Client Spreadsheet (.xlsx, .xls, .csv)
            </h2>
            <p className="text-xs text-slate-500">
              Columns needed: Name, Email ID, and Department.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Sample CSV
            </button>
            <button
              type="button"
              onClick={handleLoadSample}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              Load Sample Data
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800">
              <Upload className="h-3.5 w-3.5" />
              {fileName ? 'Change File' : 'Upload Sheet'}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-4">
            <div className="text-xs">
              <span className="text-slate-500">File:</span>{' '}
              <span className="font-semibold text-slate-900">{fileName}</span>
              <div className="text-slate-500">{rows.length} rows found</div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">Name Column</label>
              <select
                value={mapping.nameCol}
                onChange={(e) => updateMapping('nameCol', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              >
                <option value="">-- Select --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">Email Column</label>
              <select
                value={mapping.emailCol}
                onChange={(e) => updateMapping('emailCol', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              >
                <option value="">-- Select --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">Department Column</label>
              <select
                value={mapping.deptCol}
                onChange={(e) => updateMapping('deptCol', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
              >
                <option value="">-- Select --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {rows.length === 0 ? (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center hover:border-amber-500">
          <FileSpreadsheet className="mb-3 h-10 w-10 text-amber-600" />
          <div className="text-sm font-semibold text-slate-800">
            Click to upload your Excel or CSV spreadsheet
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Or click "Load Sample Data" above to try it immediately
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileUpload(e.target.files?.[0])}
            className="hidden"
          />
        </label>
      ) : (
        <>
          {/* Department Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setDeptFilter('ALL'); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                deptFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              All ({rows.length})
            </button>
            {departments.map((d) => (
              <div key={d.department} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setDeptFilter(deptFilter === d.department ? 'ALL' : d.department);
                    setPage(1);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    deptFilter === d.department
                      ? 'bg-amber-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {d.department} ({d.count})
                </button>
                {!d.exact && (
                  <button
                    type="button"
                    onClick={() => onCreateMissingTemplate(d.department)}
                    title={`Create dedicated template for ${d.department}`}
                    className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-200"
                  >
                    <PlusCircle className="h-3 w-3" />
                    Template
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Template of the Day Selector */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Select Template of the Day</h3>
                <p className="text-xs text-slate-500">
                  Pick one template to send to everyone today, or auto-match each client's department.
                </p>
              </div>
              {selectedDayTemplate && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  Selected: {selectedDayTemplate.department}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => setTemplateOfTheDayId('auto')}
                className={`flex flex-col justify-between rounded-lg border p-3 text-left transition ${
                  templateOfTheDayId === 'auto'
                    ? 'border-amber-600 bg-amber-50 ring-1 ring-amber-600'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs font-semibold text-slate-900">Auto-Match by Department</div>
                <div className="mt-1 text-[11px] text-slate-600">
                  Uses each client's Department column automatically.
                </div>
              </button>

              {templates.map((tpl) => {
                const isPicked = templateOfTheDayId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setTemplateOfTheDayId(tpl.id)}
                    className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition ${
                      isPicked
                        ? 'border-amber-600 bg-amber-50 ring-1 ring-amber-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    {tpl.posterUrl && (
                      <img
                        src={tpl.posterUrl}
                        alt={tpl.department}
                        className="h-12 w-12 shrink-0 rounded border border-slate-200 object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-900">
                        {tpl.department}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">{tpl.subject}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Batch Subject / Description Override */}
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <button
              type="button"
              onClick={() => setShowCustomMail((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-semibold text-slate-800"
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600" />
                Optional: Override Subject & Description for this send
              </span>
              <span className="text-slate-500">{showCustomMail ? 'Hide' : 'Edit'}</span>
            </button>
            {showCustomMail && (
              <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Custom Subject (leave blank to use each department template)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Happy Thanksgiving, {{name}}!"
                    value={subjectOverride}
                    onChange={(e) => setSubjectOverride(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Custom Description / Message (leave blank to use template)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional custom description for selected clients..."
                    value={bodyOverride}
                    onChange={(e) => setBodyOverride(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Client Selection Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-52 rounded-lg border border-slate-300 py-1.5 pr-3 pl-8 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => selectAllFiltered(true)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => selectAllFiltered(false)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>

              <button
                type="button"
                disabled={selectedRecipients.length === 0 || sending}
                onClick={handleSend}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {sending
                  ? 'Starting...'
                  : `Send Emails to ${selectedRecipients.length} Clients (${
                      smtpConfig?.mode === 'smtp' ? 'Live SMTP' : 'Test Mode'
                    })`}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                  <tr>
                    <th className="w-10 px-4 py-2.5">Pick</th>
                    <th className="px-4 py-2.5">Client Name</th>
                    <th className="px-4 py-2.5">Email ID</th>
                    <th className="px-4 py-2.5">Department</th>
                    <th className="px-4 py-2.5">Template</th>
                    <th className="px-4 py-2.5 text-right">Preview / Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedRows.map((row) => {
                    const tpl = resolveTemplate(row.department);
                    const rowOv = rowOverrides[row.id];
                    const effectiveTpl = tpl
                      ? {
                          ...tpl,
                          subject: rowOv?.subject || subjectOverride || tpl.subject,
                          body: rowOv?.body || bodyOverride || tpl.body,
                        }
                      : null;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            disabled={!row.validEmail}
                            onChange={() => toggleRow(row.id)}
                            className="rounded border-slate-300 text-amber-600"
                          />
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          {row.name || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={row.validEmail ? 'text-slate-700' : 'text-red-600'}>
                            {row.email || '(missing)'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{row.department || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {tpl?.department || 'None'}
                          </span>
                          {rowOv && (
                            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              Custom
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            disabled={!effectiveTpl}
                            onClick={() =>
                              setPreviewData({
                                row,
                                template: effectiveTpl,
                                subject: rowOv?.subject || subjectOverride || tpl?.subject || '',
                                body: rowOv?.body || bodyOverride || tpl?.body || '',
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                          >
                            <Eye className="h-3 w-3" />
                            Preview / Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600">
                <span>
                  Page {page} of {totalPages} ({filteredRows.length} rows)
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded border border-slate-300 px-2.5 py-1 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded border border-slate-300 px-2.5 py-1 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Live Campaign Progress & Delivery Results */}
      {activeCampaign && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Delivery Status — {activeCampaign.name}
              </h3>
              <p className="text-xs text-slate-500">
                Sent: {activeCampaign.sent} &bull; Failed: {activeCampaign.failed} &bull; Total:{' '}
                {activeCampaign.total} ({progressPct}%)
              </p>
            </div>
            <div className="flex gap-2">
              {activeCampaign.status === 'running' && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <StopCircle className="h-3.5 w-3.5" />
                  Stop
                </button>
              )}
              {activeCampaign.failed > 0 && activeCampaign.status !== 'running' && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry Failed
                </button>
              )}
              <button
                type="button"
                onClick={() => exportCampaignCsv(activeCampaign)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-amber-600 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(activeCampaign.results || []).slice(0, 250).map((r, i) => (
                  <tr key={`${r.email}-${i}`}>
                    <td className="px-3 py-2">
                      {r.name} <span className="text-slate-400">({r.email})</span>
                    </td>
                    <td className="px-3 py-2">{r.department}</td>
                    <td className="px-3 py-2">
                      {r.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                        </span>
                      ) : r.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                          <XCircle className="h-3.5 w-3.5" /> Failed
                        </span>
                      ) : (
                        <span className="text-slate-500">{r.status}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {r.error}
                      {r.previewUrl && (
                        <a
                          href={r.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-amber-700 underline"
                        >
                          View Email <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Row Preview + Per-Mail Subject & Description Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewData(null)}
              className="absolute top-3 right-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Customize Email for {previewData.row.name || previewData.row.email}
                </h3>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Subject for this client
                  </label>
                  <input
                    type="text"
                    value={previewData.subject}
                    onChange={(e) =>
                      setPreviewData((prev) => ({
                        ...prev,
                        subject: e.target.value,
                        template: { ...prev.template, subject: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Description / Message for this client
                  </label>
                  <textarea
                    rows={6}
                    value={previewData.body}
                    onChange={(e) =>
                      setPreviewData((prev) => ({
                        ...prev,
                        body: e.target.value,
                        template: { ...prev.template, body: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs leading-relaxed"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRowOverrides((prev) => ({
                        ...prev,
                        [previewData.row.id]: {
                          subject: previewData.subject,
                          body: previewData.body,
                        },
                      }));
                      setPreviewData(null);
                      notify(`Saved custom subject & description for ${previewData.row.name}`, 'success');
                    }}
                    className="rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    Save for this Client
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewData(null)}
                    className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7">
                <EmailPreviewPane
                  template={previewData.template}
                  client={previewData.row}
                  title={`Preview: ${previewData.row.name || previewData.row.email}`}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
