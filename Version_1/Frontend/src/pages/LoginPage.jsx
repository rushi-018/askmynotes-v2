import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Loader2, BookOpenCheck, ChevronRight, ShieldCheck } from "lucide-react";
import { useAuthStore } from '../authStore';
import { AUTH_BACKEND_URL } from "../api/apiConfig";

// --- Reusable SVG Icons ---
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25C22.56 11.45 22.49 10.68 22.36 9.94H12V14.28H17.96C17.67 15.63 17.03 16.8 16.14 17.48V20.2H19.83C21.66 18.57 22.56 15.69 22.56 12.25Z" fill="#4285F4"/>
    <path d="M12 23C14.97 23 17.45 22.04 19.28 20.2L16.14 17.48C15.15 18.14 13.67 18.57 12 18.57C9.31 18.57 6.99 16.81 6.09 14.39H2.38V17.21C4.18 20.79 7.8 23 12 23Z" fill="#34A853"/>
    <path d="M6.09 14.39C5.83 13.68 5.69 12.92 5.69 12.14C5.69 11.36 5.83 10.6 6.09 9.89V7.07H2.38C1.5 8.7 1 10.36 1 12.14C1 13.92 1.5 15.58 2.38 17.21L6.09 14.39Z" fill="#FBBC05"/>
    <path d="M12 5.43C13.43 5.43 14.67 5.9 15.6 6.78L18.42 4.14C16.63 2.52 14.47 1.5 12 1.5C7.8 1.5 4.18 3.71 2.38 7.07L6.09 9.89C6.99 7.47 9.31 5.43 12 5.43Z" fill="#EA4335"/>
  </svg>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const loginWithToken = useAuthStore((state) => state.loginWithToken);
  const isLoading = useAuthStore((state) => state.loading);
  
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid credentials");
    }
  };

  const handleGoogleLogin = () => {
    const backendUrl = `${AUTH_BACKEND_URL}/api/auth/login/google`;
    window.open(backendUrl, "oauth-login", "width=500,height=600");
  };

  // --- UPDATED: Handle Google Auth Message ---
  useEffect(() => {
    const handleAuthMessage = (event) => {
      // 1. Only listen to messages from your backend
      if (event.origin !== AUTH_BACKEND_URL) return;
  
      // 2. Check if the data contains our token
      if (event.data && event.data.token) {
        const { token, user } = event.data;
        
        console.log("Success! Received token and user.");
        
        // 3. Establish session
        loginWithToken(token, user);
        
        // 4. Force navigation to dashboard
        navigate("/app/dashboard", { replace: true });
      }
    };
  
    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, [loginWithToken, navigate]);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-slate-900">
      
      {/* --- Animated Mesh Background --- */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-green-900/40 to-slate-950 animate-pulse"></div>
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-green-600/20 rounded-full blur-[120px] animate-blob"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-green-500/10 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-xl rounded-[3rem] shadow-2xl p-8 sm:p-12 border border-white/20">
          
          {/* Logo Branding */}
          <div className="flex flex-col items-center mb-10">
            <div className="bg-green-600 p-3.5 rounded-2xl shadow-lg shadow-green-900/30 mb-4">
                <BookOpenCheck className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter">AskMyNotes</h2>
            <div className="flex items-center gap-1.5 mt-1.5">
                <ShieldCheck size={14} className="text-green-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grounded Study Copilot</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Access Email</label>
              <div className="group relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-green-600 transition-colors" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Key</label>
                <button type="button" onClick={() => navigate("/forgot-email")} className="text-[10px] font-bold text-green-600 hover:text-green-700">Forgot?</button>
              </div>
              <div className="group relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-green-600 transition-colors" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-center">
                <p className="text-[11px] font-bold text-red-600 uppercase tracking-tight">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-16 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 shadow-xl shadow-green-900/20 transition-all active:scale-[0.98] disabled:opacity-80 flex items-center justify-center gap-3 group overflow-hidden relative"
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <span className="uppercase tracking-widest text-xs">Authorize Entry</span>
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </button>
          </form>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <div className="relative flex justify-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] bg-white px-4">Instant Access</div>
          </div>

          <button 
            type="button" 
            onClick={handleGoogleLogin} 
            className="w-full flex items-center justify-center gap-3 py-4 border border-slate-100 rounded-2xl text-slate-700 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all bg-white shadow-sm active:scale-95"
          >
            <GoogleIcon />
            <span>Google Hub</span>
          </button>

          <p className="text-center text-[11px] text-slate-400 mt-10 font-bold uppercase tracking-widest">
            New Scholar? <Link to="/signup" className="text-green-600 hover:text-green-700 underline underline-offset-4 decoration-2">Create Account</Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -60px) scale(1.1); }
          66% { transform: translate(-30px, 30px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
        .animate-blob { animation: blob 8s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
      `}</style>
    </div>
  );
};

export default LoginPage;