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
    const [subjects, setSubjects] = useState([]);
    const [newSubjectName, setNewSubjectName] = useState('');
    const [isDragging, setIsDragging] = useState(null);
    const [uploading, setUploading] = useState({});
    const [uploadMsg, setUploadMsg] = useState(null);
    const [loading, setLoading] = useState(true);
    const fileInputRefs = useRef({});

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

    const onDragOver = (e, name) => { e.preventDefault(); setIsDragging(name); };
    const onDragLeave = () => setIsDragging(null);
    const handleDrop = (e, name) => {
        e.preventDefault();
        setIsDragging(null);
        uploadFiles(name, e.dataTransfer.files);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-4 md:space-y-6 p-3 md:p-6 pb-32 md:pb-8">
            
            {/* Header */}
            <div className="flex flex-col gap-0.5">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">My Notes</h1>
                <p className="text-[11px] md:text-sm text-gray-500 font-medium">
                    Sources for subjects (max {MAX_SUBJECTS}).
                </p>
            </div>

            {/* Upload feedback */}
            {uploadMsg && (
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-[12px] md:text-sm font-medium ${
                    uploadMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                    {uploadMsg.type === 'success' ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                    <span className="flex-1">{uploadMsg.text}</span>
                    <button onClick={() => setUploadMsg(null)} className="p-0.5 hover:bg-black/5 rounded-full"><X size={14} /></button>
                </div>
            )}

            {/* Subject cards - Updated to grid-cols-2 for mobile */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 md:gap-6">
                {subjects.map((subject) => (
                    <div
                        key={subject.name}
                        onDragOver={(e) => onDragOver(e, subject.name)}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => handleDrop(e, subject.name)}
                        className={`bg-white rounded-xl md:rounded-2xl border transition-all duration-200 flex flex-col ${
                            isDragging === subject.name ? 'border-green-500 bg-green-50/50 ring-4 ring-green-100' : 'border-gray-100 shadow-sm'
                        }`}
                    >
                        {/* Subject Header */}
                        <div className="p-3 md:p-5 border-b border-gray-50 flex flex-col gap-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-green-600 text-white shrink-0">
                                    <FileText size={16} md={22} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-[13px] md:text-lg font-bold text-gray-900 truncate leading-tight">{subject.name}</h3>
                                    <span className="text-[9px] md:text-xs text-gray-400 font-bold block">{subject.files.length} Files</span>
                                </div>
                            </div>

                            <div className="w-full">
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
                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-[11px] md:text-sm font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
                                >
                                    {uploading[subject.name] ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
                                    <span>{uploading[subject.name] ? '...' : 'Add'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Files List - Compacted for multi-column layout */}
                        <div className="p-2 md:p-5 bg-slate-50/30 flex-1">
                            {subject.files.length > 0 ? (
                                <div className="flex flex-col gap-1.5 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3">
                                    {subject.files.map((fileName, idx) => (
                                        <div key={idx} className="flex items-center p-2 rounded-lg bg-white border border-gray-100 shadow-xs overflow-hidden">
                                            <div className="p-1 bg-green-50 rounded text-green-600 mr-2 shrink-0">
                                                <FileText size={10} />
                                            </div>
                                            <span className="text-[10px] md:text-xs font-medium text-gray-700 truncate">{fileName}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 md:py-12 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                                    <Upload className={`w-6 h-6 md:w-10 md:h-10 mb-1 transition-colors ${isDragging === subject.name ? 'text-green-600' : 'text-gray-300'}`} />
                                    <p className="text-[9px] md:text-sm font-medium text-gray-500 text-center">Drop files</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add new subject */}
            {subjects.length < MAX_SUBJECTS && (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4 flex flex-col items-center gap-3">
                    <input
                        type="text"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
                        placeholder="Subject name..."
                        className="w-full bg-transparent border-b border-gray-200 focus:border-green-600 outline-none text-sm md:text-lg font-bold py-1 text-gray-900"
                    />
                    <button
                        onClick={handleAddSubject}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs md:text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors"
                    >
                        <Plus size={16} /> <span>Create</span>
                    </button>
                </div>
            )}

            {/* Usage Note */}
            <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex gap-2.5">
                <AlertCircle className="text-green-600 shrink-0 mt-0.5" size={16} />
                <div className="text-[10px] md:text-xs text-green-800 leading-snug">
                    <p><strong>Note:</strong> Citations are generated exclusively from your uploaded subject files.</p>
                </div>
            </div>
        </div>
    );
};

export default MyNotesPage;