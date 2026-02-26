import React from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpenCheck, 
  Mic2, 
  ShieldCheck, 
  ChevronRight, 
  FileText,
  MessageSquare,
  GraduationCap,
  CheckCircle2
} from 'lucide-react';

const LandingPage = () => {
  // Smooth scroll helper function for internal links
  const handleScroll = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans selection:bg-green-100 selection:text-green-900 scroll-smooth">
      
      {/* --- Navigation Bar --- */}
      <nav className="w-full flex items-center justify-between px-8 py-5 bg-white/80 backdrop-blur-md border-b border-slate-100 fixed top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-green-600 p-1.5 rounded-lg shadow-lg shadow-green-900/20">
            <BookOpenCheck className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-black text-slate-900 tracking-tight">AskMyNotes</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
          <a 
            href="#how-it-works" 
            onClick={(e) => handleScroll(e, 'how-it-works')}
            className="hover:text-green-600 transition-colors"
          >
            How it Works
          </a>
          <a 
            href="#features" 
            onClick={(e) => handleScroll(e, 'features')}
            className="hover:text-green-600 transition-colors"
          >
            Features
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login" className="px-5 py-2 text-slate-600 hover:text-slate-900 font-bold transition-colors">
            Log in
          </Link>
          <Link to="/signup" className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-md">
            Get Started
          </Link>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <header className="relative pt-40 pb-20 px-6 bg-gradient-to-b from-slate-50 to-white overflow-hidden">
        <div className="max-w-6xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-100 rounded-full text-green-700 text-xs font-black uppercase tracking-widest mb-4">
            <ShieldCheck size={14} /> Grounded AI Technology
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-tight tracking-tight">
            Chat with your notes, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500">Not the internet.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
            A subject-scoped study copilot that stays strictly within your materials. No guessing—just pure knowledge from your own files.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link to="/signup" className="w-full sm:w-auto px-10 py-4 bg-green-600 text-white text-lg font-bold rounded-2xl hover:bg-green-700 transition-all shadow-xl shadow-green-900/20 flex items-center justify-center gap-2">
              Start Studying Free <ChevronRight size={20} />
            </Link>
          </div>
        </div>
      </header>

      {/* --- How It Works Section --- */}
      <section id="how-it-works" className="py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">How it Works</h2>
            <div className="w-20 h-1.5 bg-green-500 mx-auto mt-4 rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="group p-8 rounded-3xl bg-slate-50 border border-transparent hover:border-green-100 transition-all">
              <div className="text-green-600 mb-6 group-hover:scale-110 transition-transform"><FileText size={32} /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">1. Upload Sources</h3>
              <p className="text-slate-500 text-sm font-medium">Upload exactly three subjects using PDF or TXT files to create your knowledge base.</p>
            </div>
            <div className="group p-8 rounded-3xl bg-slate-50 border border-transparent hover:border-green-100 transition-all">
              <div className="text-green-600 mb-6 group-hover:scale-110 transition-transform"><MessageSquare size={32} /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">2. Scoped Q&A</h3>
              <p className="text-slate-500 text-sm font-medium">The system answers strictly using notes from the selected subject to ensure accuracy.</p>
            </div>
            <div className="group p-8 rounded-3xl bg-slate-50 border border-transparent hover:border-green-100 transition-all">
              <div className="text-green-600 mb-6 group-hover:scale-110 transition-transform"><GraduationCap size={32} /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">3. Study Mode</h3>
              <p className="text-slate-500 text-sm font-medium">Generate 5 MCQs and 3 short-answer questions with full source references.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- Phase 2: Teacher Experience --- */}
      <section id="features" className="py-32 px-6 bg-slate-900 text-white rounded-[40px] mx-4 mb-10 overflow-hidden relative">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-black uppercase tracking-widest">
              <Mic2 size={14} /> Spoken Interaction
            </div>
            <h2 className="text-4xl font-black leading-tight">Spoken Teacher Conversations</h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              Experience the future of study with voice-to-voice interaction. Get a teacher-like spoken experience directly from your personal materials.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-slate-200 font-bold">
                <div className="bg-green-500 p-0.5 rounded-full">
                  <CheckCircle2 size={16} className="text-white" />
                </div>
                Multi-turn spoken context 
              </li>
              <li className="flex items-center gap-3 text-slate-200 font-bold">
                <div className="bg-green-500 p-0.5 rounded-full">
                  <CheckCircle2 size={16} className="text-white" />
                </div>
                Strict grounded refusal
              </li>
            </ul>
          </div>
          <div className="bg-white/5 p-12 rounded-[40px] border border-white/10 text-center backdrop-blur-sm">
             <div className="flex justify-center mb-6">
                <div className="h-24 w-24 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/40 animate-pulse">
                   <Mic2 size={48} className="text-white" />
                </div>
             </div>
             <p className="text-green-400 font-black tracking-widest uppercase text-sm">Phase 2 Active</p>
          </div>
        </div>
        {/* Background Decorative Gradient */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-green-600/5 blur-[120px] rounded-full"></div>
      </section>

      {/* --- Footer --- */}
      <footer className="py-12 text-center bg-slate-50 border-t border-slate-100">
        <p className="text-slate-400 text-sm font-medium">
          &copy; {new Date().getFullYear()} AskMyNotes. All information is grounded in your personal notes.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;