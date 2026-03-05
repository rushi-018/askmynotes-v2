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
 * Responsive: Reduced padding on mobile, better touch targets
 */
const SubjectCard = ({ title, fileCount, status, onClick, onStudy, empty }) => {
  if (empty) {
    return (
      <div className="hidden md:block bg-slate-50/50 p-6 rounded-2xl border border-dashed border-slate-200">
        <div className="h-24 flex items-center justify-center text-slate-300 italic text-sm">
          {title}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-green-100 transition-all group">
      <div className="flex justify-between items-start">
        <div className="p-3 rounded-xl bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
          <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
        </div>
        <span className={`px-2 py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${
          status === 'Ready' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
        }`}>
          {status}
        </span>
      </div>
      <div className="mt-4">
        <h3 className="text-base md:text-lg font-bold text-gray-900 group-hover:text-green-700 transition-colors truncate">
          {title}
        </h3>
        <div className="flex items-center text-xs md:text-sm text-gray-500 mt-1">
          <FileText className="w-4 h-4 mr-1 text-green-500" />
          {fileCount} Source File{fileCount !== 1 ? 's' : ''}
        </div>
      </div>
      <div className="flex items-center justify-between mt-5 md:mt-6 pt-4 border-t border-gray-50 gap-2">
        <button
          onClick={onClick}
          className="flex items-center text-green-600 text-xs md:text-sm font-bold hover:underline"
        >
          Open Hub <ChevronRight className="w-4 h-4 ml-0.5 md:ml-1" />
        </button>
        {fileCount > 0 && (
          <button
            onClick={onStudy}
            className="flex items-center gap-1 text-[11px] md:text-xs font-bold text-slate-500 hover:text-green-600"
          >
            <GraduationCap size={14} /> Study
          </button>
        )}
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const userName = user?.full_name?.split(' ')[0] || 'Scholar';
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const displaySubjects = [...subjects];
  while (displaySubjects.length < 3) {
    displaySubjects.push({ name: `Empty Slot ${displaySubjects.length + 1}`, files: [], chunkCount: 0, empty: true });
  }

  return (
    /* Added bottom padding for mobile bar (pb-24) and lateral padding (px-4) */
    <div className="space-y-6 md:space-y-8 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto">
      
      {/* --- Header Section --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            Welcome, {userName} <Sparkles className="text-green-500 w-5 h-5" />
          </h1>
          <p className="text-sm md:text-base text-gray-500 mt-0.5">
            Your subject-scoped study copilot is ready.
          </p>
        </div>
        <div className="flex items-center">
            <button 
              onClick={() => navigate('/app/notes')}
              className="w-full sm:w-auto px-5 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 shadow-lg shadow-green-900/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
                <FileText size={18} /> Manage Notes
            </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      ) : (
        <>
          {/* --- Subject Cards --- 
              Grid: 1 column on mobile, 2 on tablet, 3 on desktop
          */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {displaySubjects.map((sub, idx) => (
              <SubjectCard 
                key={sub.name + idx}
                title={sub.name}
                fileCount={sub.files?.length || 0}
                status={sub.files?.length > 0 ? 'Ready' : 'Pending'}
                empty={sub.empty}
                onClick={() => navigate(`/app/hub/${encodeURIComponent(sub.name)}`)}
                onStudy={() => navigate(`/app/study/${encodeURIComponent(sub.name)}`)}
              />
            ))}
          </div>

          {/* --- Main Content Grid --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Readiness Tracker (Full width on mobile/tablet) */}
            <div className="lg:col-span-2 bg-white p-5 md:p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-2 mb-6 md:mb-8">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <BrainCircuit className="text-green-600" size={22} /> Study Readiness
                </h3>
                <span className="text-[10px] md:text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                    Based on Activity
                </span>
              </div>
              
              <div className="space-y-6 md:space-y-8">
                {subjects.length > 0 ? subjects.map((sub, index) => {
                  const activity = getAllActivity()[sub.name] || { quizzes: 0, chats: 0, voices: 0, lastStudied: null };
                  const totalSessions = activity.quizzes + activity.chats + activity.voices;
                  const TARGET = 10;
                  const pct = Math.min(100, Math.round((totalSessions / TARGET) * 100));
                  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-400' : pct > 0 ? 'bg-orange-400' : 'bg-slate-200';

                  let statusText;
                  if (totalSessions === 0) statusText = 'Not started — chat or quiz!';
                  else if (pct >= 80) statusText = 'Well prepared!';
                  else statusText = `${TARGET - totalSessions} more to go`;

                  const lastDate = activity.lastStudied ? new Date(activity.lastStudied).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

                  return (
                    <div key={index} className="relative">
                      <div className="flex justify-between items-end mb-2">
                          <span className="text-xs md:text-sm font-bold text-gray-700 truncate max-w-[150px]">{sub.name}</span>
                          <div className="flex items-center gap-2">
                            {totalSessions > 0 && (
                              <div className="hidden xs:flex items-center gap-1.5 text-[9px] text-gray-400">
                                <span>{activity.quizzes} quiz</span>
                                <span>·</span>
                                <span>{activity.chats + activity.voices} chat</span>
                              </div>
                            )}
                            <span className="text-[11px] font-semibold text-gray-500 bg-slate-100 px-1.5 py-0.5 rounded-md">{totalSessions}/{TARGET}</span>
                          </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                              className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                              style={{ width: `${pct}%` }}
                          />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <p className={`text-[10px] md:text-[11px] ${pct >= 80 ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>{statusText}</p>
                        {lastDate && <p className="text-[10px] text-gray-300">Last: {lastDate}</p>}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="py-10 text-center text-slate-400 text-sm">
                    No activity recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions (Hidden or reformatted on mobile) */}
            <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Mic2 size={20} className="text-green-600" /> Quick Actions
              </h3>
              
              <div className="flex-1 space-y-3">
                {subjects.filter(s => s.files.length > 0).slice(0, 4).map((sub) => (
                  <button
                    key={sub.name}
                    onClick={() => navigate(`/app/hub/${encodeURIComponent(sub.name)}`)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-green-200 hover:bg-white transition-all text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen size={14} className="text-green-500" />
                      <span className="text-xs font-bold text-gray-700 truncate">{sub.name}</span>
                    </div>
                    <p className="text-[10px] md:text-[11px] text-gray-500">
                      Chat or Voice interactions
                    </p>
                  </button>
                ))}

                {subjects.filter(s => s.files.length > 0).length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                    <p className="text-xs text-gray-400 px-4">Upload files to enable quick actions.</p>
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