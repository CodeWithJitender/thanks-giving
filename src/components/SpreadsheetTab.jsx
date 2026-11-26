import React, { useMemo, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Search,
  Send,
  X,
  CheckCircle2,
  XCircle,
  StopCircle,
  RefreshCw,
  ExternalLink,
  Filter,
  Users,
  CheckSquare,
  History,
  Trash2,
} from 'lucide-react';
import { api } from '../api';
import { interpolate } from '../utils/emailBuilder';
import {
  downloadSampleXlsx,
  exportCampaignCsv,
  normalizeRows,
  parseSpreadsheetFile,
} from '../utils/spreadsheet';
import EmailPreviewPane from './EmailPreviewPane';

const PAGE_SIZE = 50;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SpreadsheetTab({
  templates,
  sheetState,
  setSheetState,
  onSaveSheetNow,
  activeCampaign,
  setActiveCampaign,
  sentHistory = [],
  onRecordSentHistory,
  onClearSentHistory,
  notify,
}) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [sentStatusFilter, setSentStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [sending, setSending] = useState(false);
  const [uploadingSheet, setUploadingSheet] = useState(false);
  const cancelRef = useRef(false);

  // Send & Preview Modal state
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [modalTemplateId, setModalTemplateId] = useState('');
  const [modalSubject, setModalSubject] = useState('');
  const [modalBody, setModalBody] = useState('');
  const [modalFromName, setModalFromName] = useState('Head Field');
  const [modalFromEmail, setModalFromEmail] = useState('greetings@headfield.com');
  const [previewClientId, setPreviewClientId] = useState('');
  const [mailStatus, setMailStatus] = useState(null);

  const { rows, selectedIds } = sheetState;

  const handleFileUpload = async (e) => {
    const file = e.target?.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    setUploadingSheet(true);
    try {
      const parsed = await parseSpreadsheetFile(file);
      const normalized = normalizeRows(parsed.rawRows, parsed.mapping);
      const nextSheet = {
        fileName: parsed.fileName,
        headers: parsed.headers,
        rawRows: parsed.rawRows,
        mapping: parsed.mapping,
        rows: normalized,
        selectedIds: new Set(),
      };
      if (onSaveSheetNow) {
        await onSaveSheetNow(nextSheet);
      } else {
        setSheetState(nextSheet);
      }
      setPage(1);
      setDeptFilter('ALL');
      notify(`Uploaded and saved ${normalized.length} rows from ${parsed.fileName} on server`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setUploadingSheet(false);
    }
  };

  const departmentList = useMemo(() => {
    const counts = new Map();
    for (const r of rows) {
      const dept = r.department || 'Unspecified';
      counts.set(dept, (counts.get(dept) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([department, count]) => ({
      department,
      count,
    }));
  }, [rows]);

  const validTotalCount = useMemo(() => rows.filter((r) => r.validEmail).length, [rows]);

  const sentByEmailMap = useMemo(() => {
    const map = new Map();
    for (const h of sentHistory) {
      const key = String(h.email || h.displayEmail || '').trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, { latest: h, count: 1 });
      } else {
        map.get(key).count += 1;
      }
    }
    return map;
  }, [sentHistory]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (deptFilter !== 'ALL' && (r.department || 'Unspecified') !== deptFilter) return false;
      const emailKey = String(r.email || '').trim().toLowerCase();
      const alreadySent = sentByEmailMap.has(emailKey);
      if (sentStatusFilter === 'SENT' && !alreadySent) return false;
      if (sentStatusFilter === 'UNSENT' && alreadySent) return false;
      if (q) {
        return (
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, deptFilter, sentStatusFilter, search, sentByEmailMap]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const filteredValidIds = useMemo(
    () => filteredRows.filter((r) => r.validEmail).map((r) => r.id),
    [filteredRows]
  );

  const allFilteredSelected =
    filteredValidIds.length > 0 && filteredValidIds.every((id) => selectedIds.has(id));

  const toggleRow = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSheetState({ ...sheetState, selectedIds: next });
  };

  const toggleSelectAllFiltered = () => {
    const next = new Set(selectedIds);
    if (allFilteredSelected) {
      for (const id of filteredValidIds) next.delete(id);
    } else {
      for (const id of filteredValidIds) next.add(id);
    }
    setSheetState({ ...sheetState, selectedIds: next });
  };

  const selectedRecipients = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id) && r.validEmail),
    [rows, selectedIds]
  );

  const openSendModal = async () => {
    if (selectedRecipients.length === 0) {
      notify('Please select at least one client first.', 'error');
      return;
    }

    const targetDept =
      (deptFilter !== 'ALL' ? deptFilter : selectedRecipients[0]?.department || '')
        .trim()
        .toLowerCase();
    const matched =
      templates.find((t) => (t.department || '').trim().toLowerCase() === targetDept) ||
      templates.find((t) => t.isDefault) ||
      templates[0];

    setModalTemplateId(matched?.id || '');
    setModalSubject(matched?.subject || '');
    setModalBody(matched?.body || '');
    setModalFromName(matched?.fromName || matched?.department || 'Head Field');
    setModalFromEmail(matched?.fromEmail || '');
    setPreviewClientId(selectedRecipients[0]?.id || '');
    setSendModalOpen(true);

    try {
      const status = await api.getMailStatus();
      setMailStatus(status);
    } catch {
      setMailStatus({ configured: false });
    }
  };

  const handleModalTemplateChange = (newTplId) => {
    setModalTemplateId(newTplId);
    const tpl = templates.find((t) => t.id === newTplId);
    if (tpl) {
      setModalSubject(tpl.subject || '');
      setModalBody(tpl.body || '');
      setModalFromName(tpl.fromName || tpl.department || 'Head Field');
      setModalFromEmail(tpl.fromEmail || '');
    }
  };

  const modalBaseTemplate = useMemo(
    () => templates.find((t) => t.id === modalTemplateId) || templates[0] || null,
    [templates, modalTemplateId]
  );

  const modalEffectiveTemplate = useMemo(() => {
    if (!modalBaseTemplate) return null;
    return {
      ...modalBaseTemplate,
      subject: modalSubject,
      body: modalBody,
    };
  }, [modalBaseTemplate, modalSubject, modalBody]);

  const previewClient = useMemo(
    () =>
      selectedRecipients.find((c) => c.id === previewClientId) ||
      selectedRecipients[0] ||
      null,
    [selectedRecipients, previewClientId]
  );

  const runBatchSend = async (recipientsToSend, effectiveTemplate, senderInfo, label) => {
    cancelRef.current = false;
    setSending(true);

    const job = {
      id: `cmp_${Date.now()}`,
      name: label,
      status: 'running',
      total: recipientsToSend.length,
      sent: 0,
      failed: 0,
      effectiveTemplate,
      senderInfo,
      results: recipientsToSend.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        department: r.department,
        status: 'pending',
        templateUsed: effectiveTemplate?.department || 'Template',
        error: null,
        previewUrl: null,
      })),
    };
    setActiveCampaign({ ...job, results: [...job.results] });

    const newlySentEntries = [];

    for (let i = 0; i < recipientsToSend.length; i++) {
      if (cancelRef.current) {
        job.status = 'cancelled';
        break;
      }

      const client = recipientsToSend[i];

      try {
        const res = await api.sendSingleEmail({
          smtpConfig: {
            fromName: senderInfo.fromName,
            fromEmail: senderInfo.fromEmail,
          },
          template: effectiveTemplate,
          client: {
            name: client.name,
            email: client.email,
            department: client.department,
          },
        });
        job.results[i] = {
          ...job.results[i],
          status: 'sent',
          previewUrl: res.previewUrl || null,
        };
        job.sent++;

        newlySentEntries.push({
          id: `hist_${Date.now()}_${i}`,
          email: String(client.email || '').trim().toLowerCase(),
          displayEmail: String(client.email || '').trim(),
          name: client.name || '',
          department: client.department || '',
          templateUsed: effectiveTemplate?.department || 'Template',
          subject: interpolate(effectiveTemplate?.subject || '', client, effectiveTemplate),
          logoUrl: effectiveTemplate?.logoUrl?.startsWith('data:') ? '' : effectiveTemplate?.logoUrl || '',
          posterUrl: effectiveTemplate?.posterUrl?.startsWith('data:') ? '' : effectiveTemplate?.posterUrl || '',
          sentAt: new Date().toISOString(),
        });

        if (i < recipientsToSend.length - 1) {
          await sleep(40);
        }
      } catch (err) {
        job.results[i] = {
          ...job.results[i],
          status: 'failed',
          error: err.message || 'Send failed',
        };
        job.failed++;
      }

      setActiveCampaign({ ...job, results: [...job.results] });
    }

    if (newlySentEntries.length > 0 && onRecordSentHistory) {
      onRecordSentHistory(newlySentEntries);
    }

    if (!cancelRef.current) {
      job.status = 'completed';
    }
    setActiveCampaign({ ...job, results: [...job.results] });
    setSending(false);
    notify(`Finished: ${job.sent} sent, ${job.failed} failed`, job.failed > 0 ? 'info' : 'success');
  };

  const handleConfirmSend = () => {
    if (!modalEffectiveTemplate || selectedRecipients.length === 0) return;
    setSendModalOpen(false);
    runBatchSend(
      selectedRecipients,
      modalEffectiveTemplate,
      {
        fromName: modalFromName.trim() || modalEffectiveTemplate.department || 'Head Field',
        fromEmail: modalFromEmail.trim(),
      },
      `${modalEffectiveTemplate.department} (${selectedRecipients.length} clients)`
    );
  };

  const handleCancel = () => {
    cancelRef.current = true;
    notify('Stopping after current email...', 'info');
  };

  const handleRetry = () => {
    if (!activeCampaign) return;
    const failed = activeCampaign.results.filter((r) => r.status === 'failed');
    if (failed.length === 0) return;
    runBatchSend(
      failed,
      activeCampaign.effectiveTemplate,
      activeCampaign.senderInfo,
      `${activeCampaign.name} (Retry ${failed.length})`
    );
  };

  const processed = (activeCampaign?.sent || 0) + (activeCampaign?.failed || 0);
  const progressPct = activeCampaign?.total
    ? Math.round((processed / activeCampaign.total) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* 1. Upload Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Upload Client Spreadsheet (.xlsx, .xls, .csv)
            </h2>
            <p className="text-xs text-slate-500">
              Filter by Department, select clients all at once or one by one, then click Send Email to choose a brand template and preview.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadSampleXlsx}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download Sample (.xlsx)
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800">
              <Upload className="h-3.5 w-3.5" />
              {uploadingSheet ? 'Saving on Server...' : 'Upload File'}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={uploadingSheet}
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {rows.length === 0 ? (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/80 p-14 text-center transition hover:border-amber-500 hover:bg-amber-50/30">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div className="text-sm font-bold text-slate-800">
            Click to upload your Excel or CSV spreadsheet
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Supports Name, Email ID, and Department / Website Name columns &mdash; saved directly on the server
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={uploadingSheet}
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      ) : (
        <>
          {/* Quick Summary Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-xs">
              <Users className="h-4 w-4 text-slate-500" />
              <div>
                <div className="text-[11px] text-slate-500">Total Rows</div>
                <div className="text-sm font-bold text-slate-900">{rows.length}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <div>
                <div className="text-[11px] text-slate-500">Valid Emails</div>
                <div className="text-sm font-bold text-slate-900">{validTotalCount}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-xs">
              <Filter className="h-4 w-4 text-amber-600" />
              <div>
                <div className="text-[11px] text-slate-500">Active Filter</div>
                <div className="truncate text-sm font-bold text-slate-900">
                  {deptFilter === 'ALL' ? 'All Departments' : deptFilter}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 shadow-xs">
              <CheckSquare className="h-4 w-4 text-amber-700" />
              <div>
                <div className="text-[11px] text-amber-800">Selected Clients</div>
                <div className="text-sm font-bold text-amber-950">{selectedRecipients.length}</div>
              </div>
            </div>
          </div>

          {/* Client Table with Department Filter Column */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="absolute top-2.5 left-3 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-56 rounded-xl border border-slate-300 bg-white py-1.5 pr-3 pl-8 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5">
                  <Filter className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-[11px] font-medium text-slate-500">Department:</span>
                  <select
                    aria-label="Filter by Department"
                    value={deptFilter}
                    onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
                    className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none"
                  >
                    <option value="ALL">All Departments ({rows.length})</option>
                    {departmentList.map((d) => (
                      <option key={d.department} value={d.department}>
                        {d.department} ({d.count})
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  aria-label="Filter by Sent Status"
                  value={sentStatusFilter}
                  onChange={(e) => { setSentStatusFilter(e.target.value); setPage(1); }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-amber-500 focus:outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="UNSENT">Not Sent Yet</option>
                  <option value="SENT">Sent Already</option>
                </select>

                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {allFilteredSelected ? 'Deselect All' : `Select All (${filteredValidIds.length})`}
                </button>
              </div>

              <button
                type="button"
                disabled={selectedRecipients.length === 0 || sending}
                onClick={openSendModal}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:from-amber-700 hover:to-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {sending
                  ? `Sending (${processed}/${activeCampaign?.total || selectedRecipients.length})...`
                  : `Send Email (${selectedRecipients.length} Selected)`}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all visible clients"
                        checked={allFilteredSelected}
                        disabled={filteredValidIds.length === 0}
                        onChange={toggleSelectAllFiltered}
                        className="rounded border-slate-300 text-amber-600"
                      />
                    </th>
                    <th className="px-4 py-3">Client Name</th>
                    <th className="px-4 py-3">Email ID</th>
                    <th className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>Department</span>
                        <select
                          aria-label="Column Filter Department"
                          value={deptFilter}
                          onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
                          className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold normal-case text-slate-700 focus:border-amber-500 focus:outline-none"
                        >
                          <option value="ALL">All</option>
                          {departmentList.map((d) => (
                            <option key={d.department} value={d.department}>
                              {d.department}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>
                    <th className="px-4 py-3">Sent Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedRows.map((row) => {
                    const sentRecord = sentByEmailMap.get(String(row.email || '').trim().toLowerCase());
                    return (
                    <tr
                      key={row.id}
                      onClick={() => row.validEmail && toggleRow(row.id)}
                      className={`transition ${
                        row.validEmail
                          ? selectedIds.has(row.id)
                            ? 'cursor-pointer bg-amber-50/40 hover:bg-amber-50/70'
                            : 'cursor-pointer hover:bg-slate-50'
                          : 'bg-red-50/30'
                      }`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          disabled={!row.validEmail}
                          onChange={() => toggleRow(row.id)}
                          className="rounded border-slate-300 text-amber-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {row.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={row.validEmail ? 'text-slate-600' : 'font-medium text-red-600'}>
                          {row.email || '(missing)'}
                        </span>
                        {!row.validEmail && (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            Invalid Email
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-800">
                          {row.department || 'Unspecified'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {sentRecord ? (
                          <div className="flex flex-col gap-0.5">
                            <span
                              title={`Sent ${sentRecord.latest.templateUsed} on ${new Date(sentRecord.latest.sentAt).toLocaleString()}`}
                              className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Sent Already{sentRecord.count > 1 ? ` (${sentRecord.count}x)` : ''}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {sentRecord.latest.templateUsed} &bull;{' '}
                              {new Date(sentRecord.latest.sentAt).toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-400">
                            Not Sent
                          </span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
                <span>
                  Page {page} of {totalPages} ({filteredRows.length} rows shown)
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
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
        <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
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
              {activeCampaign.status !== 'running' && (
                <button
                  type="button"
                  onClick={() => setActiveCampaign(null)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  Clear Log
                </button>
              )}
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Template</th>
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
                    <td className="px-3 py-2 text-slate-600">{r.templateUsed || '—'}</td>
                    <td className="px-3 py-2">
                      {r.status === 'sent' ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                        </span>
                      ) : r.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1 font-medium text-red-700">
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

      {/* Persistent Sent History with Sent Logo & Poster Thumbnails */}
      {sentHistory.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Sent Email &amp; Image History ({sentHistory.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Saved record of every email sent, including the exact logo and Thanksgiving poster image sent.
                </p>
              </div>
            </div>
            {onClearSentHistory && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Clear all saved sent history & "Sent Already" checkmarks?')) {
                    onClearSentHistory();
                  }
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear History
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">Client</th>
                  <th className="px-3 py-2.5">Department / Template</th>
                  <th className="px-3 py-2.5">Images Sent (Logo &amp; Poster)</th>
                  <th className="px-3 py-2.5">Subject</th>
                  <th className="px-3 py-2.5">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sentHistory.slice(0, 200).map((h, idx) => (
                  <tr key={h.id || `${h.email}-${idx}`} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{h.name || '—'}</div>
                      <div className="text-[11px] text-slate-500">{h.displayEmail || h.email}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">{h.templateUsed || '—'}</div>
                      <div className="text-[11px] text-slate-400">Dept: {h.department || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {h.logoUrl && (
                          <a
                            href={h.logoUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open sent logo"
                            className="block rounded border border-slate-200 bg-white p-1 hover:border-amber-500"
                          >
                            <img
                              src={h.logoUrl}
                              alt="Sent logo"
                              className="h-7 w-14 object-contain"
                            />
                          </a>
                        )}
                        {h.posterUrl && (
                          <a
                            href={h.posterUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open sent poster"
                            className="block rounded border border-slate-200 bg-white p-0.5 hover:border-amber-500"
                          >
                            <img
                              src={h.posterUrl}
                              alt="Sent poster"
                              className="h-9 w-9 rounded object-cover"
                            />
                          </a>
                        )}
                        {!h.logoUrl && !h.posterUrl && (
                          <span className="text-slate-400">Inline image</span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-slate-700" title={h.subject}>
                      {h.subject || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-slate-500">
                      {h.sentAt ? new Date(h.sentAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Send Email & Live Preview Pop-up Modal */}
      {sendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[94vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Close send popup"
              onClick={() => setSendModalOpen(false)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-5 border-b border-slate-200 pb-3.5">
              <h3 className="text-base font-bold text-slate-900">
                Compose & Preview Email ({selectedRecipients.length} Clients Selected)
              </h3>
              <p className="text-xs text-slate-500">
                Select a brand template, verify From/To/Subject and client preview, then click Send.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
              {/* Left: Template, Sender, Recipient Switcher, Subject */}
              <div className="space-y-4 md:col-span-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    1. Select Brand Template
                  </label>
                  <div className="flex items-center gap-3">
                    {modalBaseTemplate?.logoUrl && (
                      <img
                        src={modalBaseTemplate.logoUrl}
                        alt={modalBaseTemplate.department}
                        className="h-10 w-24 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1"
                      />
                    )}
                    <select
                      aria-label="Select Template"
                      value={modalTemplateId}
                      onChange={(e) => handleModalTemplateChange(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:border-amber-500 focus:outline-none"
                    >
                      {templates.map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.department}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      From Name
                    </label>
                    <input
                      type="text"
                      value={modalFromName}
                      onChange={(e) => setModalFromName(e.target.value)}
                      placeholder="Head Field"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      From Email ID
                    </label>
                    <input
                      type="email"
                      value={modalFromEmail}
                      onChange={(e) => setModalFromEmail(e.target.value)}
                      placeholder="Optional LOB sender email"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
                <p className="-mt-2 text-[11px] text-slate-500">
                  Leave Sender Email blank to use default, or enter an LOB email (note: Gmail only displays custom From emails if verified as a &ldquo;Send mail as&rdquo; alias).
                </p>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Previewing Client (To Email ID)
                  </label>
                  <select
                    aria-label="Previewing Client"
                    value={previewClient?.id || ''}
                    onChange={(e) => setPreviewClientId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                  >
                    {selectedRecipients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} &lt;{c.email}&gt; ({c.department || 'N/A'})
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Each of the {selectedRecipients.length} selected client(s) will receive this email personalized with their own name.
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={modalSubject}
                    onChange={(e) => setModalSubject(e.target.value)}
                    placeholder="Happy Thanksgiving, {{name}}!"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Email Description / Message
                  </label>
                  <textarea
                    rows={5}
                    value={modalBody}
                    onChange={(e) => setModalBody(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs leading-relaxed focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {mailStatus && !mailStatus.configured && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] text-red-800">
                    <span className="font-semibold">Mail Server Not Configured:</span> Real emails cannot be delivered yet. Add <code className="font-mono">SMTP_HOST</code>, <code className="font-mono">SMTP_PORT</code>, <code className="font-mono">SMTP_USER</code>, and <code className="font-mono">SMTP_PASS</code> (or <code className="font-mono">RESEND_API_KEY</code>) to <code className="font-mono">.env</code> locally or Vercel Environment Variables.
                  </div>
                )}
                {mailStatus?.configured && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                    <span className="font-semibold">Mail Server Connected:</span> {mailStatus.host} ({mailStatus.provider?.toUpperCase()})
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmSend}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:from-amber-700 hover:to-orange-700"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send to All {selectedRecipients.length} Selected Clients
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendModalOpen(false)}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Right: Exact Inbox Preview as Client Sees It */}
              <div className="md:col-span-7">
                <EmailPreviewPane
                  template={modalEffectiveTemplate}
                  client={previewClient}
                  fromName={modalFromName || 'Head Field'}
                  fromEmail={modalFromEmail}
                  title="Preview (As Client Will See It)"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
