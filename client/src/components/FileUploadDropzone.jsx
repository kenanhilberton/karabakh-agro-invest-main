import { useState } from 'react';
import { api } from '../api.js';
import Icon from './Icon.jsx';

const MAX_FILE_SIZE = 4 * 1024 * 1024;

// Drag & drop / click file picker. Files are uploaded **one per request** so a
// single multipart body always stays below serverless body limits.
export default function FileUploadDropzone({ files = [], onFilesChange, hint }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleUpload = async (fileList) => {
    const accepted = [];
    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`${file.name}: fayl həcmi 4 MB-dan böyük ola bilməz`);
        continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) return;
    setUploading(true);
    setUploadError('');
    try {
      const uploaded = [];
      for (const file of accepted) {
        const data = await api.upload([file]);
        if (data?.files?.length) uploaded.push(...data.files);
      }
      onFilesChange([...files, ...uploaded]);
    } catch (e) {
      setUploadError(e.message || 'Yükləmə alınmadı');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-3">
      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragActive ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/40'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleUpload(Array.from(e.dataTransfer.files));
        }}
      >
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const list = Array.from(e.target.files);
            if (list.length) handleUpload(list);
            e.target.value = '';
          }}
        />
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          ) : (
            <Icon name="upload" className="h-8 w-8 text-slate-400" />
          )}
          <span className="text-sm font-medium text-ink-900">
            {uploading ? 'Fayllar yüklənir…' : 'Faylları buraya sürükləyin və ya klikləyin'}
          </span>
          <span className="text-xs text-slate-400">
            {hint || 'PDF, DOCX, XLSX, JPG, PNG · max 4 MB · 5 fayl'}
          </span>
        </div>
      </label>

      {uploadError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-flag-red">{uploadError}</p>
      )}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
              <Icon name="file" className="h-3.5 w-3.5 text-brand-600" />
              <a
                href={f.path || f.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate hover:text-brand-700 hover:underline"
              >
                {f.originalName || f.name}
              </a>
              <span className="text-[10px] text-slate-400">{((f.size || 0) / 1024).toFixed(1)} KB</span>
              <button
                type="button"
                onClick={() => removeFile(f.id)}
                className="text-slate-400 transition hover:text-flag-red"
                title="Sil"
              >
                <Icon name="trash" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
