import React, { useEffect, useState } from 'react';
import {
  Plus,
  Save,
  Trash2,
  Upload,
  Link2,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-800">{label}</span>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
          <Upload className="h-3.5 w-3.5" />
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
            className="w-full rounded-md border border-slate-300 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-800 focus:border-amber-500 focus:outline-none"
          />
        </div>
        {!isDataUrl && fullDisplayUrl && (
          <a
            href={fullDisplayUrl}
            target="_blank"
            rel="noreferrer"
            title="Open saved image link"
            className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
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
            className={`${previewHeight} max-w-[180px] rounded border border-slate-200 bg-white object-contain p-1`}
          />
          <div className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
            {isDataUrl ? (
              <span className="font-medium text-emerald-700">
                Uploaded image saved in browser (will be embedded inline in emails)
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
  const [newDeptName, setNewDeptName] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    setDraft(activeTemplate);
    setDirty(false);
  }, [activeTemplate?.id, activeTemplate?.updatedAt]);

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
      notify('Department name cannot be empty.', 'error');
      return;
    }
    setSaving(true);
    try {
      await onUpdate(draft.id, draft);
      setDirty(false);
      notify(`Saved template for "${draft.department}"`, 'success');
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
      {/* Left: Simple Template List */}
      <div className="lg:col-span-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Department Templates</h2>
            <button
              type="button"
              onClick={() => setShowNewForm((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          {showNewForm && (
            <form
              onSubmit={handleCreateDept}
              className="mb-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5"
            >
              <input
                type="text"
                placeholder="Department name (e.g. HR, Legal)"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
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
                  className="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1.5">
            {templates.map((tpl) => {
              const selected = tpl.id === draft?.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => onSelectId(tpl.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    selected
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate font-medium">{tpl.department}</span>
                  {tpl.isDefault && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
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
            onClick={onResetDefaults}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-3 w-3" />
            Reset 3 Dummy Templates
          </button>
        </div>
      </div>

      {/* Middle: Clean Editor */}
      <div className="lg:col-span-5">
        {draft && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Edit "{draft.department}"
              </h2>
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
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition ${
                    dirty ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  {dirty ? <Save className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {saving ? 'Saving...' : dirty ? 'Save Template' : 'Saved'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Department Name
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

            <ImageField
              label="1. Top Company Logo (Upload or Image Link)"
              value={draft.logoUrl}
              onChange={(val) => updateField('logoUrl', val)}
              onUpload={(e) => handleImageUpload('logoUrl', e)}
              uploading={uploadingField === 'logoUrl'}
              previewHeight="h-10"
            />

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
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
              <label className="mb-1 block text-xs font-medium text-slate-700">
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
              <label className="mb-1 block text-xs font-medium text-slate-700">
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

      {/* Right: Simple Preview */}
      <div className="lg:col-span-4">
        <div className="mb-2.5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm">
          <span className="text-xs font-medium text-slate-600">Preview Client Name:</span>
          <input
            type="text"
            value={previewName}
            onChange={(e) => setPreviewName(e.target.value)}
            className="w-40 rounded-md border border-slate-300 px-2.5 py-1 text-xs focus:border-amber-500 focus:outline-none"
          />
        </div>
        <EmailPreviewPane
          template={draft}
          client={{
            name: previewName || 'Deeksha',
            email: 'client@example.com',
            department: draft?.department || 'General',
          }}
        />
      </div>
    </div>
  );
}
