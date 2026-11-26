import React, { useMemo, useState } from 'react';
import { Monitor, Smartphone, Mail } from 'lucide-react';
import { buildPreviewEmail } from '../utils/emailBuilder';

export default function EmailPreviewPane({ template, client, title = 'Live Email Preview' }) {
  const [viewMode, setViewMode] = useState('desktop');

  const rendered = useMemo(() => {
    if (!template) return { subject: '', html: '' };
    return buildPreviewEmail({
      template,
      client: client || {
        name: 'Deeksha',
        email: 'deeksha@example.com',
        department: template.department,
      },
    });
  }, [template, client]);

  if (!template) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
        Select or create a department template to preview.
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold text-slate-800">{title}</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('desktop')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'desktop'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setViewMode('mobile')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'mobile'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
        <div>
          <span className="font-semibold text-slate-700">To:</span>{' '}
          {client?.name ? `${client.name} <${client.email}>` : 'Deeksha <deeksha@example.com>'}
        </div>
        <div className="mt-0.5 truncate">
          <span className="font-semibold text-slate-700">Subject:</span>{' '}
          <span className="text-slate-900">{rendered.subject}</span>
        </div>
      </div>

      <div className="flex justify-center overflow-auto bg-slate-100 p-3">
        <iframe
          title="Email Preview"
          srcDoc={rendered.html}
          sandbox="allow-same-origin"
          className="rounded border border-slate-200 bg-white shadow-sm transition-all"
          style={{
            width: viewMode === 'mobile' ? '375px' : '100%',
            maxWidth: '640px',
            height: '640px',
          }}
        />
      </div>
    </div>
  );
}
