import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { recordStudyEvent } from '../utils/studyTracker';
import { 
  GraduationCap, 
  CheckCircle2, 
  XCircle,
  HelpCircle, 
  RotateCcw,
  FileSearch,
  BookOpen,
  Loader2,
  AlertCircle,
  ChevronDown
} from 'lucide-react';

const StudyModePage = () => {
  const { subjectId: urlSubjectId } = useParams();

  // ── Subject selector state ──
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(urlSubjectId ? decodeURIComponent(urlSubjectId) : '');
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('mcq');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [showModelAnswers, setShowModelAnswers] = useState({});
  const [mcqs, setMcqs] = useState([]);
  const [shortAnswers, setShortAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generated, setGenerated] = useState(false);

  // ── Fetch available subjects on mount ──
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetch('/subjects');
        if (!res.ok) throw new Error('Failed to load subjects');
        const data = await res.json();
        const list = data.subjects || [];
        setSubjects(list);
        // Auto-select from URL param if valid, otherwise first available
        if (urlSubjectId && list.includes(decodeURIComponent(urlSubjectId))) {
          setSelectedSubject(decodeURIComponent(urlSubjectId));
        } else if (list.length > 0 && !selectedSubject) {
          setSelectedSubject(list[0]);
        }
      } catch (err) {
        console.error('Failed to fetch subjects:', err);
      } finally {
        setSubjectsLoading(false);
      }
    };
    fetchSubjects();
  }, []);

  // ── Generate questions from RAG backend ──
  const generateQuestions = useCallback(async () => {
    if (!selectedSubject) {
      setError('Please select a subject first.');
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedOptions({});
    setShowModelAnswers({});

    try {
      const res = await fetch('/study_mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_id: selectedSubject }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      }

      // Map MCQs from backend format → UI format
      const mappedMcqs = (data.mcqs || []).map((m, i) => {
        // Backend returns correct_answer as letter like "A", "B", etc.
        // Options are like "A) ...", "B) ...", so match by letter prefix.
        const answerKey = (m.correct_answer || '').trim().toUpperCase();
        const correctIdx = m.options.findIndex((o) => {
          const optLetter = o.trim().charAt(0).toUpperCase();
          return optLetter === answerKey || o === m.correct_answer;
        });
        return {
          id: i + 1,
          question: m.question,
          options: m.options.map((text) => ({ text, feedback: text === m.options[correctIdx] ? 'Correct!' : (m.explanation || 'Incorrect.') })),
          correct: correctIdx >= 0 ? correctIdx : 0,
          citation: m.citation || '',
          explanation: m.explanation || '',
        };
      });

      const mappedShort = (data.short_answer || []).map((s, i) => ({
        id: i + 1,
        question: s.question,
        modelAnswer: s.expected_answer,
        citation: s.citation || '',
      }));

      setMcqs(mappedMcqs);
      setShortAnswers(mappedShort);
      setGenerated(true);
      recordStudyEvent(selectedSubject, 'quiz');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedSubject]);

  const handleOptionSelect = (qId, optIdx) => {
    if (selectedOptions[qId] !== undefined) return;
    setSelectedOptions((prev) => ({ ...prev, [qId]: optIdx }));
  };

  return (
    <div className="space-y-6 p-4 max-w-5xl mx-auto">
      
      {/* --- Header Section --- */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-green-600 rounded-2xl text-white shadow-lg shadow-green-200">
            <GraduationCap size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Study Mode</h1>
            {subjectsLoading ? (
              <p className="text-gray-400 text-sm font-medium flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading subjects…</p>
            ) : subjects.length === 0 ? (
              <p className="text-red-500 text-sm font-medium">No subjects found. Upload notes first.</p>
            ) : (
              <div className="relative mt-1">
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    setSelectedSubject(e.target.value);
                    setGenerated(false);
                    setMcqs([]);
                    setShortAnswers([]);
                    setError(null);
                    setSelectedOptions({});
                    setShowModelAnswers({});
                  }}
                  className="appearance-none bg-green-50 border-2 border-green-200 text-green-700 font-bold text-sm rounded-xl pl-4 pr-10 py-2 focus:outline-none focus:border-green-500 cursor-pointer transition-all"
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none" />
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={generateQuestions}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-green-900/20"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <GraduationCap size={18} />}
            {loading ? 'Generating…' : generated ? 'Regenerate' : 'Generate Questions'}
          </button>
          {generated && (
            <button
              onClick={() => { setSelectedOptions({}); setShowModelAnswers({}); }}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95"
            >
              <RotateCcw size={18} /> Reset Session
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
          <AlertCircle className="text-red-500 shrink-0" size={20} />
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!generated && !loading && (
        <div className="bg-white p-16 rounded-3xl border border-gray-100 shadow-sm text-center">
          <GraduationCap size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-500 mb-2">Ready to study?</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Click "Generate Questions" above to create MCQs and short-answer questions from your <span className="font-bold text-green-600">{selectedSubject || 'selected'}</span> notes.
          </p>
        </div>
      )}

      {/* Tabs + Content (only show when generated) */}
      {generated && (
        <>
          <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('mcq')}
              className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'mcq' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              MCQs ({mcqs.length})
            </button>
            <button
              onClick={() => setActiveTab('short')}
              className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'short' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Short Answer ({shortAnswers.length})
            </button>
          </div>

          {/* MCQ Section */}
          {activeTab === 'mcq' && (
            <div className="space-y-6">
              {mcqs.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                  <div className="flex justify-between items-start gap-4">
                    <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-black rounded-lg">QUESTION {idx + 1}</span>
                    {q.citation && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                        <FileSearch size={12} className="text-green-500" /> {q.citation}
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 leading-snug">{q.question}</h3>

                  <div className="grid grid-cols-1 gap-3">
                    {q.options.map((opt, i) => {
                      const isSelected = selectedOptions[q.id] === i;
                      const isCorrect = i === q.correct;
                      const hasSelected = selectedOptions[q.id] !== undefined;

                      let cardStyle = 'border-gray-100 bg-white hover:border-green-200 hover:bg-green-50/20';
                      if (isSelected) {
                        cardStyle = isCorrect ? 'border-green-500 bg-green-50 ring-2 ring-green-100' : 'border-red-500 bg-red-50 ring-2 ring-red-100';
                      } else if (hasSelected && isCorrect) {
                        cardStyle = 'border-green-500 bg-green-50/50';
                      }

                      return (
                        <button
                          key={i}
                          disabled={hasSelected}
                          onClick={() => handleOptionSelect(q.id, i)}
                          className={`relative flex items-center p-5 rounded-2xl border-2 transition-all text-left ${cardStyle}`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center shrink-0 ${
                            isSelected ? (isCorrect ? 'bg-green-500 border-green-500' : 'bg-red-500 border-red-500') : 'border-gray-200'
                          }`}>
                            {isSelected && (isCorrect ? <CheckCircle2 size={16} className="text-white" /> : <XCircle size={16} className="text-white" />)}
                          </div>
                          <span className={`text-sm font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedOptions[q.id] !== undefined && (
                    <div className={`p-5 rounded-2xl border ${
                      selectedOptions[q.id] === q.correct ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <HelpCircle size={18} className={selectedOptions[q.id] === q.correct ? 'text-green-600' : 'text-slate-500'} />
                        <span className="text-xs font-black uppercase tracking-widest text-gray-700">Explanation</span>
                      </div>
                      <p className="text-sm font-medium text-gray-600 leading-relaxed">
                        {q.explanation || q.options[selectedOptions[q.id]].feedback}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Short Answer Section */}
          {activeTab === 'short' && (
            <div className="space-y-6">
              {shortAnswers.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                  <div className="flex justify-between items-start">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-black rounded-lg">CONCEPT CHECK {idx + 1}</span>
                    {q.citation && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                        <FileSearch size={12} className="text-green-500" /> {q.citation}
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900">{q.question}</h3>

                  <textarea
                    placeholder="Type your explanation based on the notes…"
                    className="w-full p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 text-sm font-medium outline-none focus:border-green-500 focus:bg-white transition-all min-h-[140px]"
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowModelAnswers((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                      className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md shadow-green-900/10 transition-all flex items-center gap-2"
                    >
                      <BookOpen size={18} /> {showModelAnswers[q.id] ? 'Hide Model Answer' : 'Check Model Answer'}
                    </button>
                  </div>

                  {showModelAnswers[q.id] && (
                    <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800">
                      <div className="flex items-center gap-2 text-green-400 mb-3">
                        <CheckCircle2 size={18} />
                        <span className="text-xs font-black uppercase tracking-widest">Grounded Model Answer</span>
                      </div>
                      <p className="text-sm font-medium text-slate-300 leading-relaxed italic">
                        {q.modelAnswer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudyModePage;