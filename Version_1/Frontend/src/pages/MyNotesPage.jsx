import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Upload, 
  Plus, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  X
} from 'lucide-react';

const MAX_SUBJECTS = 3;

const MyNotesPage = () => {
  const [subjects, setSubjects] = useState([]);   // [{name, files:[]}]
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isDragging, setIsDragging] = useState(null);
  const [uploading, setUploading] = useState({});  // { subjectName: true }
  const [uploadMsg, setUploadMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const fileInputRefs = useRef({});

  // ── Fetch subjects + files on mount ──
  const fetchSubjects = useCallback(async () => {
    try {
      const res = await fetch('/subjects');
      const data = await res.json();
      const subjectNames = data.subjects || [];

      const subjectsWithFiles = await Promise.all(
        subjectNames.map(async (name) => {
          const fRes = await fetch(`/files/${encodeURIComponent(name)}`);
          const fData = await fRes.json();
          return { name, files: fData.files || [] };
        })
      );
      setSubjects(subjectsWithFiles);
    } catch (err) {
      console.error('Failed to load subjects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  // ── Upload files to a subject ──
  const uploadFiles = async (subjectName, fileList) => {
    const validFiles = Array.from(fileList).filter(
      (f) => f.type === 'application/pdf' || f.type === 'text/plain' || f.name.endsWith('.txt')
    );
    if (validFiles.length === 0) {
      alert('Only PDF and TXT files are accepted.');
      return;
    }

    setUploading((prev) => ({ ...prev, [subjectName]: true }));
    setUploadMsg(null);

    try {
      for (const file of validFiles) {
        const form = new FormData();
        form.append('file', file);
        form.append('subject_id', subjectName);

        const res = await fetch('/upload', { method: 'POST', body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `Upload failed (${res.status})`);
        }
      }
      setUploadMsg({ type: 'success', text: `${validFiles.length} file(s) uploaded to "${subjectName}".` });
      await fetchSubjects();
    } catch (err) {
      setUploadMsg({ type: 'error', text: err.message });
    } finally {
      setUploading((prev) => ({ ...prev, [subjectName]: false }));
    }
  };

  // ── Add a new empty subject slot ──
  const handleAddSubject = () => {
    const name = newSubjectName.trim();
    if (!name) return;
    if (subjects.length >= MAX_SUBJECTS) {
      alert(`Maximum ${MAX_SUBJECTS} subjects allowed.`);
      return;
    }
    if (subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      alert('Subject already exists.');
      return;
    }
    setSubjects((prev) => [...prev, { name, files: [] }]);
    setNewSubjectName('');
  };

  // ── Drag & Drop handlers ──
  const onDragOver = (e, name) => { e.preventDefault(); setIsDragging(name); };
  const onDragLeave = () => setIsDragging(null);
  const handleDrop = (e, name) => {
    e.preventDefault();
    setIsDragging(null);
    uploadFiles(name, e.dataTransfer.files);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Notes</h1>
          <p className="text-gray-500 mt-1">Upload source documents for your subjects (max {MAX_SUBJECTS}).</p>
        </div>
      </div>

      {/* Upload feedback */}
      {uploadMsg && (
        <div className={`p-3 rounded-xl border flex items-center gap-2 text-sm font-medium ${
          uploadMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {uploadMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {uploadMsg.text}
          <button onClick={() => setUploadMsg(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Subject cards */}
      <div className="grid grid-cols-1 gap-6">
        {subjects.map((subject) => (
          <div
            key={subject.name}
            onDragOver={(e) => onDragOver(e, subject.name)}
            onDragLeave={onDragLeave}
            onDrop={(e) => handleDrop(e, subject.name)}
            className={`bg-white rounded-2xl border transition-all duration-200 ${
              isDragging === subject.name ? 'border-green-500 bg-green-50/50 ring-4 ring-green-100' : 'border-gray-100 shadow-sm'
            }`}
          >
            {/* Subject Header */}
            <div className="p-5 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-600 text-white">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{subject.name}</h3>
                  <span className="text-xs text-gray-400">{subject.files.length} file(s) indexed</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  className="hidden"
                  ref={(el) => (fileInputRefs.current[subject.name] = el)}
                  multiple
                  accept=".pdf,.txt"
                  onChange={(e) => { uploadFiles(subject.name, e.target.files); e.target.value = ''; }}
                />
                <button
                  disabled={uploading[subject.name]}
                  onClick={() => fileInputRefs.current[subject.name]?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  {uploading[subject.name] ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  {uploading[subject.name] ? 'Uploading…' : 'Add Notes'}
                </button>
              </div>
            </div>

            {/* Files List or Drop Zone */}
            <div className="p-5">
              {subject.files.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {subject.files.map((fileName, idx) => (
                    <div key={idx} className="flex items-center p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-green-200 transition-all">
                      <div className="p-2 bg-white rounded-lg border border-gray-100 text-green-600 mr-3">
                        <FileText size={16} />
                      </div>
                      <span className="text-sm font-medium text-gray-700 truncate">{fileName}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                  <Upload className={`w-12 h-12 mb-3 transition-colors ${isDragging === subject.name ? 'text-green-600' : 'text-gray-300'}`} />
                  <p className="text-sm font-medium text-gray-600">Drag and drop PDF or TXT files here</p>
                  <p className="text-xs text-gray-400 mt-1">or click "Add Notes" to browse</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add new subject */}
      {subjects.length < MAX_SUBJECTS && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-6 flex flex-col sm:flex-row items-center gap-4">
          <input
            type="text"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
            placeholder="New subject name…"
            className="flex-1 bg-transparent border-b border-gray-200 focus:border-green-600 outline-none text-lg font-bold py-1 text-gray-900"
          />
          <button
            onClick={handleAddSubject}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors"
          >
            <Plus size={18} /> Create Subject
          </button>
        </div>
      )}

      <div className="p-4 bg-green-50/50 border border-green-100 rounded-xl flex gap-3">
        <AlertCircle className="text-green-600 shrink-0" size={20} />
        <div className="text-xs text-green-800 leading-relaxed">
          <strong>Usage Note:</strong> Only content from uploaded files in the selected subject will be used for answers.
          Citations and evidence will be provided for every response.
        </div>
      </div>
    </div>
  );
};

export default MyNotesPage;