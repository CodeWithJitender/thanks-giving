import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutTemplate,
  FileSpreadsheet,
  Send,
  CheckCircle2,
  AlertCircle,
  Info,
  Database,
} from 'lucide-react';
import { api } from './api';
import {
  DEFAULT_TEMPLATES,
  EMPTY_SHEET_STATE,
  clearLegacyBrowserStorage,
} from './utils/defaultTemplates';
import { formatClientName } from './utils/spreadsheet';
import TemplatesTab from './components/TemplatesTab';
import SpreadsheetTab from './components/SpreadsheetTab';
import AdminConsole from './components/AdminConsole';

const TABS = [
  { id: 'templates', label: '1. Brand Templates', icon: LayoutTemplate },
  { id: 'spreadsheet', label: '2. Client Sheet & Send', icon: FileSpreadsheet },
];

export default function App() {
  const isAdminRoute =
    typeof window !== 'undefined' &&
    window.location.pathname.replace(/\/+$/, '').toLowerCase() === '/admin/jkr19';

  if (isAdminRoute) {
    return <AdminConsole />;
  }

  return <MainApp />;
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    () => DEFAULT_TEMPLATES[0]?.id || null
  );
  const [activeCampaign, setActiveCampaignState] = useState(null);
  const [sentHistory, setSentHistory] = useState([]);
  const [sheetState, setSheetStateRaw] = useState(EMPTY_SHEET_STATE);
  const [loadingServer, setLoadingServer] = useState(true);
  const [dbStatus, setDbStatus] = useState('connecting'); // 'connecting' | 'connected' | 'offline'
  const [toast, setToast] = useState(null);

  const sheetSyncTimer = useRef(null);
  const campaignSyncTimer = useRef(null);

  const notify = useCallback((message, type = 'info') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Load all data directly from the server (MongoDB Atlas) — do not persist app data in localStorage
  useEffect(() => {
    clearLegacyBrowserStorage();
    let active = true;
    const syncFromServer = async () => {
      try {
        const [tplRes, sheetRes, cmpRes, histRes] = await Promise.all([
          api.getTemplates(),
          api.getSheet(),
          api.getCampaigns(),
          api.getSentHistory(),
        ]);
        if (!active) return;

        if (Array.isArray(tplRes.templates) && tplRes.templates.length > 0) {
          setTemplates(tplRes.templates);
          setSelectedTemplateId((prev) =>
            tplRes.templates.some((t) => t.id === prev) ? prev : tplRes.templates[0].id
          );
        }

        if (sheetRes.sheet && Array.isArray(sheetRes.sheet.rows)) {
          const restored = {
            ...EMPTY_SHEET_STATE,
            ...sheetRes.sheet,
            rawRows: Array.isArray(sheetRes.sheet.rawRows) ? sheetRes.sheet.rawRows : [],
            rows: sheetRes.sheet.rows.map((r) => ({ ...r, name: formatClientName(r.name) })),
            selectedIds: new Set(sheetRes.sheet.selectedIds || []),
          };
          setSheetStateRaw(restored);
        }

        if (Array.isArray(cmpRes.campaigns) && cmpRes.campaigns.length > 0) {
          setActiveCampaignState(cmpRes.campaigns[0]);
        }

        if (Array.isArray(histRes.history)) {
          setSentHistory(histRes.history);
        }

        setDbStatus('connected');
      } catch (err) {
        if (active) {
          setDbStatus('offline');
          notify(err?.message || 'Unable to reach server database', 'error');
        }
      } finally {
        if (active) setLoadingServer(false);
      }
    };

    syncFromServer();
    return () => {
      active = false;
    };
  }, [notify]);

  const serializeSheet = (next) => ({
    fileName: next.fileName || '',
    headers: next.headers || [],
    rawRows: Array.isArray(next.rawRows) ? next.rawRows.slice(0, 5000) : [],
    mapping: next.mapping || { nameCol: '', emailCol: '', deptCol: '' },
    rows: (next.rows || []).map(({ raw: _raw, ...rest }) => rest),
    selectedIds: Array.from(next.selectedIds || []),
  });

  const saveSheetImmediately = useCallback(async (nextSheet) => {
    if (sheetSyncTimer.current) clearTimeout(sheetSyncTimer.current);
    try {
      if (!nextSheet.fileName && (!nextSheet.rows || nextSheet.rows.length === 0)) {
        await api.clearSheet();
      } else {
        await api.saveSheet(serializeSheet(nextSheet));
      }
      setSheetStateRaw(nextSheet);
      setDbStatus('connected');
    } catch (err) {
      setDbStatus('offline');
      throw err;
    }
  }, []);

  const setSheetState = useCallback((nextOrUpdater) => {
    setSheetStateRaw((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;

      if (sheetSyncTimer.current) clearTimeout(sheetSyncTimer.current);
      if (!next.fileName && (!next.rows || next.rows.length === 0)) {
        api.clearSheet().catch(() => {});
      } else {
        sheetSyncTimer.current = setTimeout(() => {
          api
            .saveSheet(serializeSheet(next))
            .then(() => setDbStatus('connected'))
            .catch(() => setDbStatus('offline'));
        }, 300);
      }

      return next;
    });
  }, []);

  const setActiveCampaign = useCallback((nextOrUpdater) => {
    setActiveCampaignState((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;

      if (campaignSyncTimer.current) clearTimeout(campaignSyncTimer.current);
      if (!next) {
        api.clearCampaigns().catch(() => {});
      } else {
        const delay = next.status === 'running' ? 1200 : 50;
        campaignSyncTimer.current = setTimeout(() => {
          const compact = {
            ...next,
            effectiveTemplate: next.effectiveTemplate
              ? {
                  ...next.effectiveTemplate,
                  logoUrl: next.effectiveTemplate.logoUrl?.startsWith('data:')
                    ? ''
                    : next.effectiveTemplate.logoUrl,
                  posterUrl: next.effectiveTemplate.posterUrl?.startsWith('data:')
                    ? ''
                    : next.effectiveTemplate.posterUrl,
                }
              : null,
          };
          api
            .saveCampaign(compact)
            .then(() => setDbStatus('connected'))
            .catch(() => setDbStatus('offline'));
        }, delay);
      }

      return next;
    });
  }, []);

  const handleRecordSentHistory = useCallback((entries = []) => {
    if (!entries.length) return;
    setSentHistory((prev) => [...entries, ...prev].slice(0, 2000));
    api
      .recordSentHistory(entries)
      .then((res) => {
        if (Array.isArray(res.history)) {
          setSentHistory(res.history);
        }
        setDbStatus('connected');
      })
      .catch(() => setDbStatus('offline'));
  }, []);

  const handleClearSentHistory = useCallback(() => {
    setSentHistory([]);
    api.clearSentHistory().catch(() => {});
  }, []);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  const handleSelectTemplateId = (id) => {
    setSelectedTemplateId(id);
  };

  const handleCreateTemplate = async (payload) => {
    const res = await api.createTemplate(payload);
    setTemplates(res.templates);
    setDbStatus('connected');
    return res.template;
  };

  const handleUpdateTemplate = async (id, payload) => {
    const res = await api.updateTemplate(id, payload);
    setTemplates(res.templates);
    setDbStatus('connected');
    return res.template;
  };

  const handleDeleteTemplate = async (id) => {
    if (templates.length <= 1) {
      throw new Error('Cannot delete the last remaining template');
    }
    const res = await api.deleteTemplate(id);
    setTemplates(res.templates);
    setDbStatus('connected');
    if (selectedTemplateId === id && res.templates.length > 0) {
      handleSelectTemplateId(res.templates[0].id);
    }
  };

  const handleResetDefaults = async () => {
    const res = await api.resetTemplates();
    setTemplates(res.templates);
    handleSelectTemplateId(res.templates[0].id);
    setDbStatus('connected');
    notify(`Restored all ${res.templates.length} organization brand templates on server`, 'success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-slate-50 to-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
              <Send className="h-4.5 w-4.5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                Thanksgiving Campaign Studio
              </h1>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>Organization Brand Templates &bull; Client Sheet &bull; Bulk Mailer</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    dbStatus === 'connected'
                      ? 'bg-emerald-50 text-emerald-700'
                      : dbStatus === 'connecting'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  <Database className="h-2.5 w-2.5" />
                  {dbStatus === 'connected'
                    ? 'Saved on Server'
                    : dbStatus === 'connecting'
                      ? 'Connecting Server...'
                      : 'Server Offline'}
                </span>
              </div>
            </div>
          </div>

          <nav className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-amber-600' : ''}`} />
                  {tab.label}
                  {tab.id === 'templates' && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      {templates.length}
                    </span>
                  )}
                  {tab.id === 'spreadsheet' && sheetState.selectedIds.size > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {sheetState.selectedIds.size}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {loadingServer ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-sm">
            Loading templates and uploaded data from server...
          </div>
        ) : (
          <>
            {activeTab === 'templates' && (
              <TemplatesTab
                templates={templates}
                selectedId={selectedTemplateId}
                onSelectId={handleSelectTemplateId}
                onCreate={handleCreateTemplate}
                onUpdate={handleUpdateTemplate}
                onDelete={handleDeleteTemplate}
                onResetDefaults={handleResetDefaults}
                notify={notify}
              />
            )}

            {activeTab === 'spreadsheet' && (
              <SpreadsheetTab
                templates={templates}
                sheetState={sheetState}
                setSheetState={setSheetState}
                onSaveSheetNow={saveSheetImmediately}
                activeCampaign={activeCampaign}
                setActiveCampaign={setActiveCampaign}
                sentHistory={sentHistory}
                onRecordSentHistory={handleRecordSentHistory}
                onClearSentHistory={handleClearSentHistory}
                notify={notify}
              />
            )}
          </>
        )}
      </main>

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
