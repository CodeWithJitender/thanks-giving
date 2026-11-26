import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutTemplate,
  FileSpreadsheet,
  Settings,
  Send,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  DEFAULT_TEMPLATES,
  loadStoredSmtp,
  loadStoredTemplates,
  saveStoredSmtp,
  saveStoredTemplates,
} from './utils/defaultTemplates';
import TemplatesTab from './components/TemplatesTab';
import SpreadsheetTab from './components/SpreadsheetTab';
import SmtpSettingsTab from './components/SmtpSettingsTab';

const TABS = [
  { id: 'templates', label: '1. Templates', icon: LayoutTemplate },
  { id: 'spreadsheet', label: '2. Upload Sheet & Send', icon: FileSpreadsheet },
  { id: 'smtp', label: '3. SMTP Settings', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState(() => loadStoredTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    () => loadStoredTemplates()[0]?.id || null
  );
  const [smtpConfig, setSmtpConfig] = useState(() => loadStoredSmtp());
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
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const handleCreateTemplate = async (payload) => {
    const dept = (payload.department || 'New Department').trim();
    const base = templates[0] || DEFAULT_TEMPLATES[0];
    const newTemplate = {
      id: `dept-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      department: dept,
      isDefault: Boolean(payload.isDefault),
      subject: payload.subject || `Happy Thanksgiving, {{name}} — From ${dept}`,
      greeting: payload.greeting || 'Dear {{name}},',
      body:
        payload.body ||
        `As Thanksgiving approaches, we want to take a moment to express our sincere gratitude for the trust you place in our ${dept} team.\n\nWe wish you and your loved ones a happy Thanksgiving filled with warmth, joy, and time spent with family and friends.`,
      logoUrl: payload.logoUrl || base.logoUrl,
      logoWidth: Number(payload.logoWidth) || 210,
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
    notify('Restored the 3 default Thanksgiving templates', 'success');
  };

  const handleCreateMissingTemplate = async (departmentName) => {
    try {
      const created = await handleCreateTemplate({ department: departmentName });
      setSelectedTemplateId(created.id);
      setActiveTab('templates');
      notify(`Created template for "${departmentName}"`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleSaveSmtp = async (payload) => {
    const saved = saveStoredSmtp(payload);
    setSmtpConfig(saved);
    return saved;
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white">
              <Send className="h-4 w-4" />
            </div>
            <h1 className="text-base font-bold text-slate-900">Thanksgiving Bulk Emailer</h1>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('smtp')}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              smtpConfig?.mode === 'smtp'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                smtpConfig?.mode === 'smtp' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {smtpConfig?.mode === 'smtp' ? `SMTP: ${smtpConfig.host}` : 'Simulation Mode'}
          </button>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav className="-mb-px flex gap-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
                    active
                      ? 'border-amber-600 text-amber-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
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
            smtpConfig={smtpConfig}
            sheetState={sheetState}
            setSheetState={setSheetState}
            activeCampaign={activeCampaign}
            setActiveCampaign={setActiveCampaign}
            onCreateMissingTemplate={handleCreateMissingTemplate}
            notify={notify}
          />
        )}

        {activeTab === 'smtp' && (
          <SmtpSettingsTab
            smtpConfig={smtpConfig}
            onSaveSmtp={handleSaveSmtp}
            templates={templates}
            notify={notify}
          />
        )}
      </main>

      {toast && (
        <div className="fixed right-5 bottom-5 z-50 flex max-w-md items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl">
          {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
          {toast.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />}
          {toast.type === 'info' && <Info className="h-4 w-4 shrink-0 text-amber-400" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
