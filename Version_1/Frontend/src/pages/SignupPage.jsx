import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, CheckCircle, Loader2, ChevronRight, BookOpenCheck } from "lucide-react";
import { useAuthStore } from '../authStore';
import { API_BASE_URL, AUTH_BACKEND_URL } from "../api/apiConfig";

// --- Reusable SVG Icons ---
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25C22.56 11.45 22.49 10.68 22.36 9.94H12V14.28H17.96C17.67 15.63 17.03 16.8 16.14 17.48V20.2H19.83C21.66 18.57 22.56 15.69 22.56 12.25Z" fill="#4285F4"/>
    <path d="M12 23C14.97 23 17.45 22.04 19.28 20.2L16.14 17.48C15.15 18.14 13.67 18.57 12 18.57C9.31 18.57 6.99 16.81 6.09 14.39H2.38V17.21C4.18 20.79 7.8 23 12 23Z" fill="#34A853"/>
    <path d="M6.09 14.39C5.83 13.68 5.69 12.92 5.69 12.14C5.69 11.36 5.83 10.6 6.09 9.89V7.07H2.38C1.5 8.7 1 10.36 1 12.14C1 13.92 1.5 15.58 2.38 17.21L6.09 14.39Z" fill="#FBBC05"/>
    <path d="M12 5.43C13.43 5.43 14.67 5.9 15.6 6.78L18.42 4.14C16.63 2.52 14.47 1.5 12 1.5C7.8 1.5 4.18 3.71 2.38 7.07L6.09 9.89C6.99 7.47 9.31 5.43 12 5.43Z" fill="#EA4335"/>
  </svg>
);

const SignupPage = () => {
  const navigate = useNavigate();
  const loginWithToken = useAuthStore((state) => state.loginWithToken);
  
  const [full_name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const userData = { full_name, email, password };

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        let errorMsg = `Error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorMsg;
        } catch (jsonError) {}
        throw new Error(errorMsg);
      }

      setSuccess("Account established! Preparing your hub...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    const backendUrl = `${AUTH_BACKEND_URL}/api/auth/login/google`;
    window.open(backendUrl, "oauth-login", "width=500,height=600");
  };

  useEffect(() => {
    const handleAuthMessage = (event) => {
      const { token } = event.data;
      if (token) {
        const user = loginWithToken(token);
        if (user) navigate("/app/dashboard", { replace: true });
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
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-green-600/20 rounded-full blur-[120px] animate-blob"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-green-500/10 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-xl rounded-[3rem] shadow-2xl p-8 sm:p-12 border border-white/20">
          
          {/* Logo Branding */}
          <div className="flex flex-col items-center mb-8">
            <div className="bg-green-600 p-3 rounded-2xl shadow-lg shadow-green-900/30 mb-4">
                <BookOpenCheck className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Join AskMyNotes</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">Start your grounded study journey</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Full Identity</label>
              <div className="group relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-green-600 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Mayuresh Marade"
                  value={full_name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Access Email</label>
              <div className="group relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-green-600 transition-colors" size={18} />
                <input
                  type="email"
                  placeholder="scholar@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Security Key</label>
              <div className="group relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-green-600 transition-colors" size={18} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-green-500 focus:bg-white transition-all outline-none"
                  required
                  minLength="5"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-center">
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-tight">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-center">
                <p className="text-[10px] font-bold text-green-600 uppercase tracking-tight">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 shadow-xl shadow-green-900/20 transition-all active:scale-[0.98] disabled:opacity-80 flex items-center justify-center gap-3 group overflow-hidden relative"
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <span className="uppercase tracking-widest text-xs">Establish Account</span>
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <div className="relative flex justify-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] bg-white px-4">Instant Access</div>
          </div>

          <button 
            type="button" 
            onClick={handleGoogleSignup} 
            className="w-full flex items-center justify-center gap-3 py-3.5 border border-slate-100 rounded-2xl text-slate-700 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all bg-white shadow-sm active:scale-95"
          >
            <GoogleIcon />
            <span>Google Hub</span>
          </button>

          <p className="text-center text-[11px] text-slate-400 mt-8 font-bold uppercase tracking-widest">
            Existing Scholar? <Link to="/login" className="text-green-600 hover:text-green-700 underline underline-offset-4 decoration-2">Access Portal</Link>
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

export default SignupPage;