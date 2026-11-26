import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Save,
  Trash2,
  Upload,
  Link2,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Search,
} from 'lucide-react';
import { api } from '../api';
import EmailPreviewPane from './EmailPreviewPane';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function ImageField({ label, value, onChange, onUpload, uploading, previewHeight = 'h-12' }) {
  const isDataUrl = Boolean(value && value.startsWith('data:'));
  const fullDisplayUrl =
    !isDataUrl && value && value.startsWith('/')
      ? `${window.location.origin}${value}`
      : value || '';

  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-800">{label}</span>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50">
          <Upload className="h-3.5 w-3.5 text-amber-600" />
          {uploading ? 'Uploading...' : 'Upload Image'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
            disabled={uploading}
            onChange={onUpload}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Paste image link (https://...) or upload above"
            value={isDataUrl ? '' : value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-800 focus:border-amber-500 focus:outline-none"
          />
        </div>
        {!isDataUrl && fullDisplayUrl && (
          <a
            href={fullDisplayUrl}
            target="_blank"
            rel="noreferrer"
            title="Open saved image link"
            className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {value && (
        <div className="flex items-center gap-3">
          <img
            src={value}
            alt={label}
            className={`${previewHeight} max-w-[180px] rounded-lg border border-slate-200 bg-white object-contain p-1`}
          />
          <div className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
            {isDataUrl ? (
              <span className="font-medium text-emerald-700">
                Uploaded image saved (embedded inline in emails)
              </span>
            ) : (
              <>
                Saved link: <span className="font-mono text-slate-700">{fullDisplayUrl}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TemplatesTab({
  templates,
  selectedId,
  onSelectId,
  onCreate,
  onUpdate,
  onDelete,
  onResetDefaults,
  notify,
}) {
  const activeTemplate = templates.find((t) => t.id === selectedId) || templates[0] || null;
  const [draft, setDraft] = useState(activeTemplate);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploadingField, setUploadingField] = useState('');
  const [previewName, setPreviewName] = useState('Deeksha');
  const [brandSearch, setBrandSearch] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    setDraft(activeTemplate);
    setDirty(false);
  }, [activeTemplate?.id, activeTemplate?.updatedAt]);

  const filteredTemplates = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => (t.department || '').toLowerCase().includes(q));
  }, [templates, brandSearch]);

  const updateField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleImageUpload = async (field, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingField(field);
    try {
      const dataUrl = await fileToDataUrl(file);
      const uploaded = await api.uploadImage(file.name, dataUrl);
      updateField(field, uploaded.inline ? uploaded.url : uploaded.fullUrl || uploaded.url);
      notify(`Loaded "${file.name}" — click Save Template to keep changes.`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setUploadingField('');
      event.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.department?.trim()) {
      notify('Brand / Department name cannot be empty.', 'error');
      return;
    }
    setSaving(true);
    try {
      await onUpdate(draft.id, draft);
      setDirty(false);
      notify(`Saved "${draft.department}" template`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    const dept = newDeptName.trim();
    if (!dept) return;
    try {
      const created = await onCreate({ department: dept });
      setNewDeptName('');
      setShowNewForm(false);
      onSelectId(created.id);
      notify(`Created template for "${dept}"`, 'success');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!draft) return;
    try {
      await onDelete(draft.id);
      notify(`Deleted "${draft.department}"`, 'info');
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Left: Organization Brand Templates List */}
      <div className="lg:col-span-3">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Organization Brands</h2>
              <p className="text-[11px] text-slate-500">{templates.length} templates ready</p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewForm((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          {showNewForm && (
            <form
              onSubmit={handleCreateDept}
              className="mb-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5"
            >
              <input
                type="text"
                placeholder="Brand or department name"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          <div className="relative mb-2.5">
            <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search brands..."
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs focus:border-amber-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="max-h-[540px] space-y-1.5 overflow-y-auto pr-1">
            {filteredTemplates.map((tpl) => {
              const selected = tpl.id === draft?.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onSelectId(tpl.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                    selected
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-100 bg-slate-50/70 text-slate-800 hover:border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tpl.brandColor || '#d97706' }}
                    />
                    <span className="truncate font-semibold">{tpl.department}</span>
                  </div>
                  {tpl.isDefault && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        selected ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      Default
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Restore all 13 default templates? This will overwrite any custom logos you uploaded.')) {
                onResetDefaults();
              }
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-3 w-3" />
            Reset All 13 Brand Templates
          </button>
        </div>
      </div>

      {/* Middle: Polished Editor */}
      <div className="lg:col-span-5">
        {draft && (
          <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
              <div>
                <h2 className="text-base font-bold text-slate-900">{draft.department}</h2>
                <p className="text-[11px] text-slate-500">
                  Logo on top &rarr; Dear {'{{name}}'}, + Message &rarr; Thanksgiving Poster
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={templates.length <= 1}
                  title="Delete template"
                  className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-xs transition ${
                    dirty
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700'
                      : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  {dirty ? <Save className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {saving ? 'Saving...' : dirty ? 'Save Template' : 'Saved'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Brand / Department Name
                </label>
                <input
                  type="text"
                  value={draft.department || ''}
                  onChange={(e) => updateField('department', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.isDefault)}
                    onChange={(e) => updateField('isDefault', e.target.checked)}
                    className="rounded border-slate-300 text-amber-600"
                  />
                  Default fallback template
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Sender Display Name (for this LOB)
                </label>
                <input
                  type="text"
                  value={draft.fromName || ''}
                  onChange={(e) => updateField('fromName', e.target.value)}
                  placeholder={draft.department || 'Head Field'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Sender Email ID (for this LOB)
                </label>
                <input
                  type="email"
                  value={draft.fromEmail || ''}
                  onChange={(e) => updateField('fromEmail', e.target.value)}
                  placeholder="Optional custom sender email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <ImageField
              label="1. Top Brand Logo (Upload or Image Link)"
              value={draft.logoUrl}
              onChange={(val) => updateField('logoUrl', val)}
              onUpload={(e) => handleImageUpload('logoUrl', e)}
              uploading={uploadingField === 'logoUrl'}
              previewHeight="h-10"
            />

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Email Subject
              </label>
              <input
                type="text"
                value={draft.subject || ''}
                onChange={(e) => updateField('subject', e.target.value)}
                placeholder="Happy Thanksgiving, {{name}}!"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                2. Greeting (use {'{{name}}'} for client name)
              </label>
              <input
                type="text"
                value={draft.greeting || ''}
                onChange={(e) => updateField('greeting', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Email Description / Message
              </label>
              <textarea
                rows={5}
                value={draft.body || ''}
                onChange={(e) => updateField('body', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-amber-500 focus:outline-none"
              />
            </div>

            <ImageField
              label="3. Bottom Poster Image (Upload or Image Link)"
              value={draft.posterUrl}
              onChange={(val) => updateField('posterUrl', val)}
              onUpload={(e) => handleImageUpload('posterUrl', e)}
              uploading={uploadingField === 'posterUrl'}
              previewHeight="h-24"
            />
          </div>
        )}
      </div>

      {/* Right: Live Inbox Preview */}
      <div className="lg:col-span-4">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-sm">
          <span className="text-xs font-semibold text-slate-700">Preview Client Name:</span>
          <input
            type="text"
            value={previewName}
            onChange={(e) => setPreviewName(e.target.value)}
            className="w-40 rounded-lg border border-slate-300 px-2.5 py-1 text-xs focus:border-amber-500 focus:outline-none"
          />
        </div>
        <EmailPreviewPane
          template={draft}
          client={{
            name: previewName || 'Deeksha',
            email: 'client@example.com',
            department: draft?.department || 'Head Field',
          }}
          fromName={draft?.fromName || draft?.department || 'Head Field'}
          fromEmail={draft?.fromEmail || ''}
          title={`Preview: ${draft?.department || 'Template'}`}
        />
      </div>
    </div>
  );
}
