import React, { useState } from "react";
import { KeyRound, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");

  const handleReset = () => {
    if (!pwd || pwd.length < 8) return setError("Min 8 characters required");
    if (pwd !== confirmPwd) return setError("Passwords do not match");
    alert("Password reset successfully!");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/95 p-8 rounded-3xl shadow-xl">

        <button
          onClick={() => navigate("/verify-otp")}
          className="flex items-center gap-2 text-sm text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4" /> Back
        </button>

        <h2 className="text-xl font-bold text-gray-900 mb-4">Set New Password</h2>

        {/* New Password */}
        <label className="text-sm font-medium">New Password</label>
        <div className="relative mt-1">
          <KeyRound className="absolute left-3 top-3 text-gray-400" />
          <input
            type="password"
            className={`w-full pl-10 pr-3 py-3 border rounded-lg ${error?"border-red-500":""}`}
            value={pwd}
            onChange={e=>[setPwd(e.target.value), setError("")]}
          />
        </div>

        {/* Confirm Password */}
        <label className="text-sm mt-4 font-medium block">Confirm Password</label>
        <input
          type="password"
          className={`w-full mt-1 py-3 px-3 border rounded-lg ${error?"border-red-500":""}`}
          value={confirmPwd}
          onChange={e=>[setConfirmPwd(e.target.value), setError("")]}
        />

        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

        <button
          onClick={handleReset}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 mt-6"
        >
          Reset Password
        </button>

      </div>
    </div>
  );
};

export default ResetPasswordPage;
