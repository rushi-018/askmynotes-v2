import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Chatbot from './Chatbot';

const MainLayout = () => {
  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
      {/* 1. Sidebar 
        Fixed on the left side
      */}
      <Sidebar />

      {/* 2. Main Content Area 
        flex-1 makes it take up remaining width
        overflow-y-auto allows the page to scroll while sidebar stays fixed
      */}
      <main className="flex-1 overflow-y-auto h-full relative">
        {/* Optional: Add a top header here if you need one */}
        
        {/* Render the specific page content (Dashboard, FeatureOne, etc.) */}
        <div className="p-8">
            <Outlet />
        </div>
      </main>
      <Chatbot/>
    </div>
  );
};

export default MainLayout;