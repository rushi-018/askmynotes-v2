import React from 'react';
import { NavLink as RouterNavLink } from 'react-router-dom';
import { useAuthStore } from '../authStore';
import { 
    LayoutDashboard, 
    FolderOpen, 
    MessageSquare, 
    GraduationCap, 
    User, 
    LogOut,
    BookOpenCheck,
} from 'lucide-react';

/**
 * --- Reusable NavLink Component (Desktop) ---
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
 * --- Reusable Tab Component (Mobile) ---
 */
const MobileTab = ({ to, icon, label }) => (
    <RouterNavLink
        to={to}
        end={to === "/app/dashboard"}
        className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 transition-colors h-full ${
                isActive ? 'text-green-500' : 'text-slate-400'
            }`
        }
    >
        {icon}
        <span className="text-[10px] mt-1 font-medium">{label}</span>
    </RouterNavLink>
);

export default function Sidebar() {
    const logout = useAuthStore((state) => state.logout);

    return (
        <>
            {/* --- DESKTOP SIDEBAR --- */}
            <aside className="hidden lg:flex h-screen w-72 bg-linear-to-b from-slate-900 to-green-950 border-r border-slate-700 flex flex-col shrink-0">
                <div className="p-6 border-b border-slate-700 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <div className="bg-green-600 p-1.5 rounded-lg">
                            <BookOpenCheck className="h-6 w-6 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-100 tracking-tight">AskMyNotes</h1>
                    </div>
                    <p className="text-xs text-green-400 font-medium pl-1 italic">Subject-Scoped Copilot</p>
                </div>

                <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
                    <div>
                        <h2 className="px-3 mb-2 text-xs font-semibold text-green-400 uppercase tracking-wider">Workspace</h2>
                        <NavLink to="/app/dashboard" icon={<LayoutDashboard size={20} />}>Dashboard</NavLink>
                        <NavLink to="/app/notes" icon={<FolderOpen size={20} />}>My Notes</NavLink>
                    </div>

                    <div>
                        <h2 className="px-3 mb-2 text-xs font-semibold text-green-400 uppercase tracking-wider">Learning Hub</h2>
                        <NavLink to="/app/hub" icon={<MessageSquare size={20} />} badge="Voice">Chat with Notes</NavLink>
                        <NavLink to="/app/study" icon={<GraduationCap size={20} />}>Study Mode</NavLink>
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-700 bg-slate-900/50">
                    <div className="space-y-1">
                        <NavLink to="/app/profile" icon={<User size={20} />}>My Profile</NavLink>
                        <button onClick={logout} className="w-full flex items-center p-3 my-1 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200">
                            <LogOut size={20} />
                            <span className="ml-4 text-sm font-medium">Log Out</span>
                        </button>
                    </div>
                </div>
            </aside>


            {/* --- MOBILE BOTTOM NAVIGATION (ZOMATO STYLE FIX) --- */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 flex items-center justify-between h-16 z-[100] shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
                
                {/* Left Tabs */}
                <MobileTab to="/app/dashboard" icon={<LayoutDashboard size={22} />} label="Home" />
                <MobileTab to="/app/notes" icon={<FolderOpen size={22} />} label="Notes" />
                
                {/* Center "Action" Button Container */}
                <div className="relative flex-1 flex justify-center h-full">
                    <RouterNavLink 
                        to="/app/hub" 
                        className={({ isActive }) => 
                            `absolute -top-6 flex items-center justify-center w-14 h-14 rounded-full shadow-lg border-4 border-slate-900 transition-all duration-200 active:scale-90 ${
                                isActive ? 'bg-white text-green-600' : 'bg-green-600 text-white'
                            }`
                        }
                    >
                        <MessageSquare size={24} />
                    </RouterNavLink>
                    <span className="text-[10px] mt-auto pb-2 text-slate-400 font-medium">Hub</span>
                </div>

                {/* Right Tabs */}
                <MobileTab to="/app/study" icon={<GraduationCap size={22} />} label="Study" />
                <MobileTab to="/app/profile" icon={<User size={22} />} label="Profile" />
            </div>
        </>
    );
}