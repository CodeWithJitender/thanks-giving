import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutTemplate,
  FileSpreadsheet,
  Send,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  DEFAULT_TEMPLATES,
  loadStoredTemplates,
  saveStoredTemplates,
} from './utils/defaultTemplates';
import TemplatesTab from './components/TemplatesTab';
import SpreadsheetTab from './components/SpreadsheetTab';

const TABS = [
  { id: 'templates', label: '1. Brand Templates', icon: LayoutTemplate },
  { id: 'spreadsheet', label: '2. Client Sheet & Send', icon: FileSpreadsheet },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState(() => loadStoredTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    () => loadStoredTemplates()[0]?.id || null
  );
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [toast, setToast] = useState(null);

  const [sheetState, setSheetState] = useState({
    fileName: '',
    headers: [],
    rawRows: [],
    mapping: { nameCol: '', emailCol: '', deptCol: '' },
    rows: [],
    selectedIds: new Set(),
  });

  const notify = useCallback((message, type = 'info') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleCreateTemplate = async (payload) => {
    const dept = (payload.department || 'New Brand').trim();
    const base = templates[0] || DEFAULT_TEMPLATES[0];
    const newTemplate = {
      id: `brand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      department: dept,
      brandColor: payload.brandColor || '#d97706',
      isDefault: Boolean(payload.isDefault),
      subject: payload.subject || `Happy Thanksgiving, {{name}} — From ${dept}!`,
      greeting: payload.greeting || 'Dear {{name}},',
      body:
        payload.body ||
        `As Thanksgiving approaches, we want to take a moment to express our sincere gratitude for the trust you place in ${dept}.\n\nWe wish you and your loved ones a happy Thanksgiving filled with warmth, joy, and time spent with family and friends.`,
      logoUrl: payload.logoUrl || base.logoUrl,
      logoWidth: Number(payload.logoWidth) || 220,
      posterUrl: payload.posterUrl || base.posterUrl,
      updatedAt: new Date().toISOString(),
    };

    let next = [...templates];
    if (newTemplate.isDefault) {
      next = next.map((t) => ({ ...t, isDefault: false }));
    }
    next.push(newTemplate);
    saveStoredTemplates(next);
    setTemplates(next);
    return newTemplate;
  };

  const handleUpdateTemplate = async (id, payload) => {
    let next = [...templates];
    if (payload.isDefault) {
      next = next.map((t) => ({ ...t, isDefault: false }));
    }
    next = next.map((t) =>
      t.id === id ? { ...t, ...payload, id, updatedAt: new Date().toISOString() } : t
    );
    saveStoredTemplates(next);
    setTemplates(next);
    return next.find((t) => t.id === id);
  };

  const handleDeleteTemplate = async (id) => {
    if (templates.length <= 1) {
      throw new Error('Cannot delete the last remaining template');
    }
    let next = templates.filter((t) => t.id !== id);
    if (!next.some((t) => t.isDefault) && next.length > 0) {
      next[0] = { ...next[0], isDefault: true };
    }
    saveStoredTemplates(next);
    setTemplates(next);
    if (selectedTemplateId === id && next.length > 0) {
      setSelectedTemplateId(next[0].id);
    }
  };

  const handleResetDefaults = () => {
    saveStoredTemplates(DEFAULT_TEMPLATES);
    setTemplates(DEFAULT_TEMPLATES);
    setSelectedTemplateId(DEFAULT_TEMPLATES[0].id);
    notify(`Restored all ${DEFAULT_TEMPLATES.length} organization brand templates`, 'success');
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
              <p className="text-[11px] text-slate-500">
                Organization Brand Templates &bull; Client Sheet Filter &bull; Bulk Mailer
              </p>
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
                  onClick={() => setActiveTab(tab.id)}
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
        {activeTab === 'templates' && (
          <TemplatesTab
            templates={templates}
            selectedId={selectedTemplateId}
            onSelectId={setSelectedTemplateId}
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
            activeCampaign={activeCampaign}
            setActiveCampaign={setActiveCampaign}
            notify={notify}
          />
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
