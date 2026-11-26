import React, { useEffect, useState } from 'react';
import { Save, PlugZap, Send, FlaskConical } from 'lucide-react';
import { api } from '../api';

const PRESETS = [
  { name: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 587, secure: false },
  { name: 'Outlook / Office 365', host: 'smtp.office365.com', port: 587, secure: false },
  { name: 'AWS SES', host: 'email-smtp.us-east-1.amazonaws.com', port: 587, secure: false },
  { name: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, secure: false },
  { name: 'Brevo', host: 'smtp-relay.brevo.com', port: 587, secure: false },
];

export default function SmtpSettingsTab({ smtpConfig, onSaveSmtp, templates, notify }) {
  const [form, setForm] = useState(smtpConfig || {});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [creatingEthereal, setCreatingEthereal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testTemplateId, setTestTemplateId] = useState(templates[0]?.id || '');
  const [sendingTest, setSendingTest] = useState(false);
  const [lastPreviewUrl, setLastPreviewUrl] = useState('');

  useEffect(() => {
    if (smtpConfig) setForm(smtpConfig);
  }, [smtpConfig]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSmtp(form);
      notify('SMTP settings saved in system', 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      await onSaveSmtp(form);
      const res = await api.testSmtp();
      notify(res.message, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleCreateEthereal = async () => {
    setCreatingEthereal(true);
    try {
      const res = await api.createEthereal();
      setForm(res.config);
      await onSaveSmtp(res.config);
      notify('Test SMTP account created and saved!', 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setCreatingEthereal(false);
    }
  };

  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testEmail) return;
    setSendingTest(true);
    setLastPreviewUrl('');
    try {
      await onSaveSmtp(form);
      const res = await api.sendTestEmail({
        toEmail: testEmail,
        toName: 'Deeksha',
        templateId: testTemplateId,
      });
      if (res.previewUrl) setLastPreviewUrl(res.previewUrl);
      notify(res.message, 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">SMTP Configuration Keys</h2>
            <p className="text-xs text-slate-500">
              Enter your SMTP credentials once — they stay saved in the system.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateEthereal}
            disabled={creatingEthereal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            {creatingEthereal ? 'Creating...' : 'Create Free Test SMTP'}
          </button>
        </div>

        <div className="flex gap-3">
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs font-medium">
            <input
              type="radio"
              checked={form.mode !== 'smtp'}
              onChange={() => setForm((f) => ({ ...f, mode: 'simulation' }))}
            />
            Simulation Mode (Dry Run)
          </label>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 p-3 text-xs font-medium">
            <input
              type="radio"
              checked={form.mode === 'smtp'}
              onChange={() => setForm((f) => ({ ...f, mode: 'smtp' }))}
            />
            Live SMTP Sending
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, mode: 'smtp', host: p.host, port: p.port, secure: p.secure }))
              }
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700">SMTP Host</label>
            <input
              type="text"
              value={form.host || ''}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              placeholder="smtp.gmail.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">SMTP Port</label>
            <input
              type="number"
              value={form.port || 587}
              onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              SMTP Username / API Key
            </label>
            <input
              type="text"
              value={form.user || ''}
              onChange={(e) => setForm({ ...form, user: e.target.value })}
              placeholder="you@company.com or apikey"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              SMTP Password / Secret Key
            </label>
            <input
              type="password"
              value={form.pass || ''}
              onChange={(e) => setForm({ ...form, pass: e.target.value })}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">From Name</label>
            <input
              type="text"
              value={form.fromName || ''}
              onChange={(e) => setForm({ ...form, fromName: e.target.value })}
              placeholder="Head Field"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">From Email</label>
            <input
              type="email"
              value={form.fromEmail || ''}
              onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
              placeholder="greetings@headfield.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Reply-To Email (optional)
            </label>
            <input
              type="email"
              value={form.replyTo || ''}
              onChange={(e) => setForm({ ...form, replyTo: e.target.value })}
              placeholder="support@headfield.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Send Delay (ms)
            </label>
            <input
              type="number"
              min="0"
              value={form.delayMs ?? 150}
              onChange={(e) => setForm({ ...form, delayMs: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(form.secure)}
            onChange={(e) => setForm({ ...form, secure: e.target.checked })}
            className="rounded border-slate-300 text-amber-600"
          />
          Use SSL/TLS (port 465) — leave unchecked for STARTTLS (port 587)
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <PlugZap className="h-3.5 w-3.5" />
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save SMTP Settings'}
          </button>
        </div>
      </form>

      {/* Send Test Email */}
      <div className="lg:col-span-5">
        <form
          onSubmit={handleSendTest}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-slate-900">Send a Test Email</h3>
          <p className="text-xs text-slate-500">
            Verify one email before sending to your full spreadsheet.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Recipient Email</label>
            <input
              type="email"
              required
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Template</label>
            <select
              value={testTemplateId}
              onChange={(e) => setTestTemplateId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.department}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={sendingTest}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
          >
            <Send className="h-3.5 w-3.5" />
            {sendingTest ? 'Sending...' : 'Send Test Email'}
          </button>

          {lastPreviewUrl && (
            <div className="rounded-lg bg-indigo-50 p-3 text-xs text-indigo-800">
              <a href={lastPreviewUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                Open Delivered Test Email &rarr;
              </a>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
