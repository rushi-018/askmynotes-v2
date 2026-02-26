import React from 'react';
import { NavLink as RouterNavLink } from 'react-router-dom';
import { useAuthStore } from '../authStore';
import { 
    LayoutDashboard, 
    FolderOpen, 
    MessageSquare, 
    GraduationCap, 
    Settings, 
    User, 
    LogOut,
    BookOpenCheck,
    Mic2,
    Sparkles
} from 'lucide-react';

/**
 * --- Reusable NavLink Component ---
 * Theme: Green-600 active state to match the Dropper theme
 */
const NavLink = ({ to, icon, children, badge }) => (
    <RouterNavLink
        to={to}
        end={to === "/app/dashboard"} 
        className={({ isActive }) =>
            `flex items-center justify-between p-3 my-1 rounded-lg transition-all duration-200 ${
                isActive 
                ? 'bg-green-600 text-white font-semibold shadow-md shadow-green-900/20' 
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`
        }
    >
        <div className="flex items-center">
            {icon}
            <span className="ml-4 text-sm">{children}</span>
        </div>
        {badge && (
            <span className="text-[10px] bg-green-500/30 text-green-200 px-2 py-0.5 rounded-full border border-green-400/30">
                {badge}
            </span>
        )}
    </RouterNavLink>
);

/**
 * --- Main Sidebar Component ---
 */
export default function Sidebar() {
    const logout = useAuthStore((state) => state.logout);

    return (
        // Theme: Slate-900 to Green-950 Gradient
        <div className="h-screen w-72 bg-linear-to-b from-slate-900 to-green-950 border-r border-slate-700 flex flex-col shrink-0 transition-all duration-300">
            
            {/* Header: Project Branding */}
            <div className="p-6 border-b border-slate-700 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <div className="bg-green-600 p-1.5 rounded-lg">
                        <BookOpenCheck className="h-6 w-6 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-100 tracking-tight">AskMyNotes</h1>
                </div>
                <p className="text-xs text-green-400 font-medium pl-1 italic">Subject-Scoped Copilot</p>
            </div>

            {/* Navigation Section */}
            <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
                
                {/* Knowledge Management (Phase 1 Requirements) */}
                <div>
                    <h2 className="px-3 mb-2 text-xs font-semibold text-green-400 uppercase tracking-wider">
                        Workspace
                    </h2>
                    <NavLink to="/app/dashboard" icon={<LayoutDashboard size={20} />}>
                        Dashboard
                    </NavLink>
                    <NavLink to="/app/notes" icon={<FolderOpen size={20} />}>
                        My Notes
                    </NavLink>
                </div>

                {/* AI & Learning (Phase 1 & 2) */}
                <div>
                    <h2 className="px-3 mb-2 text-xs font-semibold text-green-400 uppercase tracking-wider">
                        Learning Hub
                    </h2>
                    <NavLink 
                        to="/app/hub" 
                        icon={<MessageSquare size={20} />}
                        badge="Voice"
                    >
                        Chat with Notes
                    </NavLink>
                    <NavLink to="/app/study" icon={<GraduationCap size={20} />}>
                        Study Mode
                    </NavLink>
                </div>

                {/* Teacher Mode Feature Card (Phase 2 Spoken Interaction) */}
                {/* <div className="pt-2">
                    <div className="mx-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                        <div className="flex items-center gap-2 text-green-400 mb-1">
                            <Mic2 size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Teacher Active</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            Spoken interaction and multi-turn conversations enabled. [cite: 35, 36]
                        </p>
                    </div>
                </div> */}
            </nav>

            {/* Footer Section: User Profile & Logout */}
            <div className="p-4 border-t border-slate-700 bg-slate-900/50">
                <div className="space-y-1">
                    <NavLink to="/app/profile" icon={<User size={20} />}>
                        My Profile
                    </NavLink>
                    
                    {/* Logout Button */}
                    <button 
                        onClick={logout}
                        className="w-full flex items-center p-3 my-1 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
                    >
                        <LogOut size={20} />
                        <span className="ml-4 text-sm font-medium">Log Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}