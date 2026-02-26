import React, { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { useAuthStore } from './authStore.js';
import './App.css';

// --- Public Pages ---
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage.jsx";
import ForgotEmailPage from "./pages/ForgotEmailPage.jsx";
import VerifyOtpPage from "./pages/VerifyOtpPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import ErrorPage from './pages/ErrorPage.jsx';
import Chatbot from './components/Chatbot.jsx';

// --- Private App Pages ---
import DashboardPage from './pages/DashboardPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import MyNotesPage from './pages/MyNotesPage.jsx';
import SubjectHub from './pages/SubjectHub.jsx';
import StudyModePage from './pages/StudyModePage.jsx';

// --- Layout ---
import MainLayout from './components/MainLayout.jsx';

// --- Protected Route Wrapper ---
function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loading = useAuthStore((state) => state.loading);

  if (loading) return null; 

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// --- Router Configuration ---
const router = createBrowserRouter([
  // PUBLIC ROUTES
  {
    path: '/',
    element: <LandingPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },

  // 📌 Forgot Password Flow (Separated into 3 screens)
  {
    path: '/forgot-email',
    element: <ForgotEmailPage />,
  },
  {
    path: '/verify-otp',
    element: <VerifyOtpPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },

  // PROTECTED ROUTES
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <MainLayout />
        <Chatbot/>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'notes', element: <MyNotesPage /> }, // New Page for uploading
      { path: 'hub', element: <SubjectHub /> },
      { path: 'hub/:subjectId', element: <SubjectHub /> }, // New Page for Chat/Voice
      { path: 'study', element: <StudyModePage /> },
      { path: 'study/:subjectId', element: <StudyModePage /> }, // New Page for MCQs
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
]);

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const loading = useAuthStore((state) => state.loading);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <h1 className="text-lg font-medium text-gray-600 animate-pulse">
            Loading Application...
          </h1>
        </div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

export default App;
