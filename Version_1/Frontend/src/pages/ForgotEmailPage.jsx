import React, { useState } from "react";
import { Mail, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ForgotEmailPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSendOtp = () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return setError("Enter a valid email");
    }
    navigate("/verify-otp");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/95 rounded-3xl p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="mx-auto bg-blue-600 p-3 rounded-xl w-fit">
            <Lock className="h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mt-4">Reset Password</h2>
          <p className="text-gray-600 text-sm">Enter your registered email</p>
        </div>

        <label className="text-sm text-gray-700">Email</label>
        <div className="relative mt-2">
          <Mail className="absolute left-3 top-3 text-gray-400" />
          <input
            type="email"
            className={`w-full pl-10 pr-3 py-3 border rounded-lg ${error?"border-red-500":""}`}
            placeholder="you@example.com"
            value={email}
            onChange={(e)=>[setEmail(e.target.value), setError("")]}
          />
        </div>

        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}

        <button 
          onClick={handleSendOtp}
          className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
        >
          Send OTP
        </button>

        <button
          onClick={() => navigate("/")}
          className="w-full text-sm text-blue-600 mt-4"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default ForgotEmailPage;
