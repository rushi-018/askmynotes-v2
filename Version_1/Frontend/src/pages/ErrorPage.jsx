import React, { useState } from 'react';
import { useRouteError, Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, AlertTriangle, Terminal } from 'lucide-react';

const ErrorPage = () => {
  const error = useRouteError();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  // Determine error type
  const is404 = error?.status === 404;
  
  // Dynamic Content based on error type
  const title = is404 ? "Page Not Found" : "Something Went Wrong";
  const message = is404 
    ? "Sorry, we couldn't find the page you're looking for. It might have been moved or deleted."
    : "An unexpected error occurred. Our team has been notified.";
  
  const errorCode = error?.status || 500;
  const errorMessage = error?.statusText || error?.message || "Unknown Error";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden font-sans">
      
      {/* --- Background Decorative Elements --- */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-20 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* --- Main Content Card --- */}
      <div className="relative z-10 max-w-lg w-full bg-white/80 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl p-8 md:p-12 text-center mx-4">
        
        {/* Large Background Number Effect */}
        <div className="relative">
          <h1 className="text-9xl font-black text-gray-100 select-none">
            {errorCode}
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
             {is404 ? (
                 <span className="text-6xl">🤔</span>
             ) : (
                 <AlertTriangle className="h-20 w-20 text-red-500/80 drop-shadow-lg" />
             )}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
            {title}
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed">
            {message}
          </p>
        </div>

        {/* --- Action Buttons --- */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-all border border-gray-200"
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </button>

          <Link 
            to="/"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all"
          >
            <Home className="h-5 w-5" />
            Back Home
          </Link>
        </div>

        {/* --- Developer Tools (Error Details) --- */}
        {!is404 && (
          <div className="mt-12 border-t border-gray-100 pt-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-2 mx-auto transition-colors"
            >
              <Terminal className="h-4 w-4" />
              {showDetails ? "Hide Technical Details" : "Show Technical Details"}
            </button>
            
            {showDetails && (
              <div className="mt-4 p-4 bg-gray-900 rounded-lg text-left overflow-hidden">
                <code className="text-xs font-mono text-green-400 break-all">
                  <span className="text-gray-500 select-none">$ error_log: </span><br/>
                  {errorMessage}
                  {error?.stack && (
                    <>
                      <br /><br />
                      <span className="text-gray-500">Stack Trace:</span><br/>
                      {error.stack}
                    </>
                  )}
                </code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- CSS for Background Blobs Animation --- */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default ErrorPage;