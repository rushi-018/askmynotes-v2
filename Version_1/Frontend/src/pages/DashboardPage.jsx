import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../authStore';
import { getAllActivity } from '../utils/studyTracker';
import { 
  BookOpen, 
  FileText, 
  BrainCircuit, 
  Mic2,
  ChevronRight,
  Sparkles,
  GraduationCap,
  Loader2
} from 'lucide-react';

/**
 * --- Helper Component: Subject Card ---
 */
const SubjectCard = ({ title, fileCount, status, onClick, onStudy }) => (
  <div 
    className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-green-100 transition-all group"
  >
    <div className="flex justify-between items-start">
      <div className="p-3 rounded-xl bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
        <BookOpen className="w-6 h-6" />
      </div>
      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
        status === 'Ready' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
      }`}>
        {status}
      </span>
    </div>
    <div className="mt-4">
      <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-700 transition-colors">{title}</h3>
      <div className="flex items-center text-sm text-gray-500 mt-1">
        <FileText className="w-4 h-4 mr-1 text-green-500" />
        {fileCount} Source File{fileCount !== 1 ? 's' : ''}
      </div>
    </div>
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-50 gap-2">
      <button
        onClick={onClick}
        className="flex items-center text-green-600 text-sm font-bold hover:underline"
      >
        Open Hub <ChevronRight className="w-4 h-4 ml-1" />
      </button>
      {fileCount > 0 && (
        <button
          onClick={onStudy}
          className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-green-600"
        >
          <GraduationCap size={14} /> Study
        </button>
      )}
    </div>
  </div>
);

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const userName = user?.full_name?.split(' ')[0] || 'Scholar';
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Fetch subjects + file counts from RAG backend ──
  const fetchSubjects = useCallback(async () => {
    try {
      const res = await fetch('/subjects');
      const data = await res.json();
      const subjectNames = data.subjects || [];

      const subjectsWithFiles = await Promise.all(
        subjectNames.map(async (name) => {
          const fRes = await fetch(`/files/${encodeURIComponent(name)}`);
          const fData = await fRes.json();
          return { name, files: fData.files || [], chunkCount: fData.chunk_count || 0 };
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

  // Pad to 3 slots for UI
  const displaySubjects = [...subjects];
  while (displaySubjects.length < 3) {
    displaySubjects.push({ name: `Empty Slot ${displaySubjects.length + 1}`, files: [], chunkCount: 0, empty: true });
  }

  return (
    <div className="space-y-8 p-2">
      
      {/* --- Header Section --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Welcome, {userName} <Sparkles className="text-green-500 w-5 h-5" />
          </h1>
          <p className="text-gray-500 mt-1">
            Your subject-scoped study copilot is ready.
          </p>
        </div>
        <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/app/notes')}
              className="px-5 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 shadow-lg shadow-green-900/20 transition-all flex items-center gap-2"
            >
                <FileText size={18} /> Manage Notes
            </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      ) : (
        <>
          {/* --- Subject Cards --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {displaySubjects.map((sub, idx) => (
              <SubjectCard 
                key={sub.name}
                title={sub.name}
                fileCount={sub.files.length}
                status={sub.files.length > 0 ? 'Ready' : 'Pending'}
                onClick={() => navigate(`/app/hub/${encodeURIComponent(sub.name)}`)}
                onStudy={() => navigate(`/app/study/${encodeURIComponent(sub.name)}`)}
              />
            ))}
          </div>

          {/* --- Study Readiness --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <BrainCircuit className="text-green-600" /> Study Readiness
                </h3>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                    Based on Your Activity
                </span>
              </div>
              
              <div className="space-y-8">
                {displaySubjects.map((sub, index) => {
                  const activity = getAllActivity()[sub.name] || { quizzes: 0, chats: 0, voices: 0, lastStudied: null };
                  const totalSessions = activity.quizzes + activity.chats + activity.voices;
                  const TARGET = 10; // 10 interactions = fully prepared
                  const pct = Math.min(100, Math.round((totalSessions / TARGET) * 100));
                  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-400' : pct > 0 ? 'bg-orange-400' : 'bg-slate-200';

                  let statusText;
                  if (totalSessions === 0) statusText = 'Not started yet — try chatting or generating a quiz!';
                  else if (pct >= 80) statusText = 'Well prepared — keep it up!';
                  else statusText = `${TARGET - totalSessions} more interaction${TARGET - totalSessions !== 1 ? 's' : ''} to go`;

                  const lastDate = activity.lastStudied ? new Date(activity.lastStudied).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

                  return (
                    <div key={index} className="relative">
                      <div className="flex justify-between mb-2">
                          <span className="text-sm font-bold text-gray-700">{sub.name}</span>
                          <div className="flex items-center gap-3">
                            {totalSessions > 0 && (
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                <span>{activity.quizzes} quiz{activity.quizzes !== 1 ? 'zes' : ''}</span>
                                <span>·</span>
                                <span>{activity.chats + activity.voices} chat{(activity.chats + activity.voices) !== 1 ? 's' : ''}</span>
                              </div>
                            )}
                            <span className="text-xs font-semibold text-gray-500">{totalSessions} / {TARGET}</span>
                          </div>
                      </div>
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                          <div 
                              className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                              style={{ width: `${pct}%` }}
                          />
                      </div>
                      <div className="flex justify-between mt-1">
                        <p className={`text-[10px] ${pct >= 80 ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>{statusText}</p>
                        {lastDate && <p className="text-[10px] text-gray-300">Last: {lastDate}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Mic2 size={20} className="text-green-600" /> Quick Actions
              </h3>
              
              <div className="flex-1 space-y-3">
                {subjects.filter(s => s.files.length > 0).map((sub) => (
                  <button
                    key={sub.name}
                    onClick={() => navigate(`/app/hub/${encodeURIComponent(sub.name)}`)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-green-200 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen size={14} className="text-green-500" />
                      <span className="text-xs font-bold text-gray-700">{sub.name}</span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {sub.files.length} file{sub.files.length !== 1 ? 's' : ''} indexed — Chat or Voice
                    </p>
                  </button>
                ))}

                {subjects.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400">No subjects yet.</p>
                    <button
                      onClick={() => navigate('/app/notes')}
                      className="mt-2 text-sm font-bold text-green-600 hover:underline"
                    >
                      Upload your first notes
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;