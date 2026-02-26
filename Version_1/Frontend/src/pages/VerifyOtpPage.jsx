import React, { useState, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const VerifyOtpPage = () => {
  const navigate = useNavigate();
  const OTP_LENGTH = 6;
  const otpRefs = useRef([]);
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");

  const handleVerify = () => {
    if (otp.join("").length !== OTP_LENGTH) {
      return setError("Enter complete OTP");
    }
    navigate("/reset-password");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/95 rounded-3xl p-8 shadow-xl">

        <button
          onClick={() => navigate("/forgot-email")}
          className="text-sm text-gray-700 flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="h-4" /> Back
        </button>

        <h2 className="text-xl font-bold text-gray-900 mb-3">Verify OTP</h2>
        <p className="text-sm text-gray-600">Enter the 6-digit code</p>

        {/* OTP Inputs */}
        <div className="flex justify-center gap-3 my-4">
          {otp.map((val, idx) => (
            <input
              key={idx}
              ref={(el)=>otpRefs.current[idx] = el}
              maxLength={1}
              className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-300"
              value={val}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                const arr = [...otp];
                arr[idx] = v;
                setOtp(arr);
                if (v && idx < OTP_LENGTH - 1) otpRefs.current[idx+1].focus();
                setError("");
              }}
            />
          ))}
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          onClick={handleVerify}
          className="mt-5 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
        >
          Verify OTP
        </button>
      </div>
    </div>
  );
};

export default VerifyOtpPage;
