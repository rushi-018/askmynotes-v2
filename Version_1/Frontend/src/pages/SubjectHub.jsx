import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { recordStudyEvent } from '../utils/studyTracker';
import { 
  Mic, 
  MicOff, 
  Send, 
  Info, 
  ChevronRight, 
  FileText, 
  Volume2, 
  ShieldCheck, 
  AlertCircle,
  Database,
  Loader2,
  StopCircle,
  ChevronDown
} from 'lucide-react';

const SubjectHub = () => {
  const { subjectId: urlSubjectId } = useParams();

  // ── Subject selector state ──
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(urlSubjectId ? decodeURIComponent(urlSubjectId) : '');
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeEvidence, setActiveEvidence] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const scrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const historyRef = useRef([]);

  // ── Fetch available subjects on mount ──
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetch('/subjects');
        if (!res.ok) throw new Error('Failed to load subjects');
        const data = await res.json();
        const list = data.subjects || [];
        setSubjects(list);
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

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message — resets when subject changes
  useEffect(() => {
    if (!selectedSubject) return;
    setMessages([{
      id: 1,
      role: 'assistant',
      content: `Hello! I'm ready to answer your questions about "${selectedSubject}". Ask me anything from your uploaded notes.`,
      type: 'text',
    }]);
    historyRef.current = [];
    setActiveEvidence(null);
  }, [selectedSubject]);

  // ── Text Chat ──
  const handleSendText = useCallback(async () => {
    const q = query.trim();
    if (!q || isSending) return;

    const userMsg = { id: Date.now(), role: 'user', content: q, type: 'text' };
    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setIsSending(true);

    historyRef.current.push({ role: 'user', content: q });

    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          subject_id: selectedSubject,
          history: historyRef.current.slice(-10),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }

      const data = await res.json();
      const citations = (data.citations || []).map((c) => ({
        file: c.file_name,
        page: c.page_number,
        snippet: c.chunk_text,
        relevance: c.relevance_score,
      }));

      const botMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.answer,
        type: 'text',
        confidence: data.confidence,
        citations,
      };

      historyRef.current.push({ role: 'assistant', content: data.answer });
      setMessages((prev) => [...prev, botMsg]);
      setActiveEvidence(citations.length > 0 ? citations : null);
      recordStudyEvent(selectedSubject, 'chat');
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: Date.now() + 2,
        role: 'assistant',
        content: `Error: ${err.message}`,
        type: 'text',
      }]);
    } finally {
      setIsSending(false);
    }
  }, [query, selectedSubject, isSending]);

  // ── Voice Recording (MediaRecorder) ──
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendVoiceChat(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Please allow microphone access to use voice chat.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const toggleVoice = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // ── Voice Chat API ──
  const sendVoiceChat = async (audioBlob) => {
    setIsVoiceProcessing(true);

    const form = new FormData();
    form.append('audio_file', audioBlob, 'recording.webm');
    form.append('subject_id', selectedSubject);
    form.append('history', JSON.stringify(historyRef.current.slice(-10)));

    try {
      const res = await fetch('/voice-chat', { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status}`);
      }

      // Extract metadata from custom headers
      const transcript = decodeURIComponent(res.headers.get('X-Transcript') || '');
      const answer = decodeURIComponent(res.headers.get('X-Answer') || '');
      const citationsJson = decodeURIComponent(res.headers.get('X-Citations') || '[]');
      const confidence = res.headers.get('X-Confidence') || 'Low';
      let rawCitations = [];
      try { rawCitations = JSON.parse(citationsJson); } catch {}

      const citations = rawCitations.map((c) => ({
        file: c.file_name,
        page: c.page_number,
        snippet: c.chunk_text,
        relevance: c.relevance_score,
      }));

      // Add user transcript message
      if (transcript) {
        historyRef.current.push({ role: 'user', content: transcript });
        setMessages((prev) => [...prev, {
          id: Date.now(),
          role: 'user',
          content: transcript,
          type: 'voice',
        }]);
      }

      // Add bot answer message
      historyRef.current.push({ role: 'assistant', content: answer });
      recordStudyEvent(selectedSubject, 'voice');
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: answer,
        type: 'voice',
        confidence,
        citations,
      }]);
      setActiveEvidence(citations.length > 0 ? citations : null);

      // Play audio response
      const audioData = await res.blob();
      const audioUrl = URL.createObjectURL(audioData);
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {});
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: Date.now() + 2,
        role: 'assistant',
        content: `Voice error: ${err.message}`,
        type: 'text',
      }]);
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4 p-2 overflow-hidden">
      
      {/* --- Main Chat Area (Left Pane) --- */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <Database size={20} />
            </div>
            <div>
              {subjectsLoading ? (
                <p className="text-gray-400 text-sm font-medium flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading subjects…</p>
              ) : subjects.length === 0 ? (
                <p className="text-red-500 text-sm font-bold">No subjects found. Upload notes first.</p>
              ) : (
                <div className="relative">
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="appearance-none bg-green-50 border-2 border-green-200 text-green-700 font-bold text-sm rounded-xl pl-3 pr-9 py-1.5 focus:outline-none focus:border-green-500 cursor-pointer transition-all"
                  >
                    {subjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none" />
                </div>
              )}
              <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold uppercase tracking-wider mt-0.5">
                <ShieldCheck size={12} /> Grounded Mode Active
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Teacher Voice: </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`w-1 h-3 rounded-full bg-green-200 ${isRecording ? 'animate-bounce' : ''}`} style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-green-600 text-white shadow-lg shadow-green-900/10' 
                  : 'bg-slate-50 border border-slate-100 text-gray-800'
              }`}>
                {msg.type === 'voice' && msg.role === 'user' && (
                  <div className="flex items-center gap-1 mb-1">
                    <Mic size={12} className={msg.role === 'user' ? 'text-green-200' : 'text-green-500'} />
                    <span className="text-[10px] opacity-70">Voice</span>
                  </div>
                )}
                <p className="text-sm leading-relaxed">{msg.content}</p>
                
                {msg.role === 'assistant' && msg.confidence && (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      msg.confidence === 'High' ? 'bg-green-100 text-green-700' :
                      msg.confidence === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {msg.confidence} CONFIDENCE
                    </span>
                    {msg.citations?.length > 0 && (
                      <button 
                        onClick={() => setActiveEvidence(msg.citations)}
                        className="text-[10px] font-bold text-green-600 hover:underline flex items-center"
                      >
                        View Sources <ChevronRight size={10} />
                      </button>
                    )}
                  </div>
                )}

                {msg.type === 'voice' && msg.role === 'assistant' && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-green-500">
                    <Volume2 size={12} /> Audio played
                  </div>
                )}
              </div>
            </div>
          ))}

          {(isSending || isVoiceProcessing) && (
            <div className="flex justify-start">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 size={16} className="animate-spin" />
                {isVoiceProcessing ? 'Processing voice…' : 'Thinking…'}
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-50">
          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
            <button 
              onClick={toggleVoice}
              disabled={isVoiceProcessing}
              className={`p-3 rounded-xl transition-all ${
                isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-gray-500 hover:text-green-600 shadow-sm'
              } disabled:opacity-50`}
            >
              {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
            </button>
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder={isRecording ? 'Listening to your question…' : 'Ask your notes anything…'}
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 placeholder:text-gray-400"
              disabled={isRecording || isVoiceProcessing}
            />
            <button 
              onClick={handleSendText}
              disabled={isSending || !query.trim()}
              className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-md transition-colors disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-[10px] text-center text-gray-400 mt-2 italic">
            Click the mic to start/stop voice recording, or type your question.
          </p>
        </div>
      </div>

      {/* --- Evidence & Citations Sidebar (Right Pane) --- */}
      <div className="w-80 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <Info className="text-green-400" size={18} />
          <h3 className="font-bold text-white text-sm">Grounding Evidence</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {activeEvidence && activeEvidence.length > 0 ? (
            activeEvidence.map((cite, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-400">
                    <FileText size={14} />
                    <span className="text-[10px] font-bold truncate max-w-[100px]">{cite.file}</span>
                  </div>
                  <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                    Pg {cite.page}
                  </span>
                </div>
                {cite.snippet && (
                  <p className="text-[11px] text-slate-300 italic leading-relaxed">
                    "{cite.snippet}"
                  </p>
                )}
                {cite.relevance > 0 && (
                  <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full rounded-full" style={{ width: `${Math.round(cite.relevance * 100)}%` }} />
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-600 mb-3">
                <Database size={24} />
              </div>
              <p className="text-xs text-slate-500">Ask a question to see supporting evidence snippets from your notes.</p>
            </div>
          )}
        </div>

        {/* Refusal Guard */}
        <div className="m-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-center gap-2 text-orange-400 mb-1">
            <AlertCircle size={14} />
            <span className="text-[10px] font-bold uppercase">Refusal Guard</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            The system responds <strong>"Not found in your notes"</strong> if information is missing.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubjectHub;