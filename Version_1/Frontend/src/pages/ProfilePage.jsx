import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../authStore';
import { 
  User, 
  Mail, 
  Briefcase, 
  Camera, 
  Save, 
  X,
  Edit2,
  ShieldCheck,
  Languages,
  Mic2,
  Volume2,
  Settings as SettingsIcon
} from 'lucide-react';

const ProfilePage = () => {
  const user = useAuthStore((state) => state.user);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    language: 'English',
    voiceEnabled: true,
    teacherMode: 'Encouraging'
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        full_name: user.full_name || 'Scholar Name',
        email: user.email || '',
        role: user.role || 'Student'
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsEditing(false);
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto pb-10 p-4 space-y-4">
      
      {/* --- Header Section --- */}
      <div className="relative h-40 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-green-900 overflow-hidden shadow-lg border border-slate-700">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-10 w-32 h-32 bg-green-400/10 rounded-full blur-2xl"></div>
      </div>

      <div className="relative px-2 sm:px-6">
        {/* Avatar & Basic Info - Horizontal Layout */}
        <div className="flex flex-row items-center -mt-12 mb-6 gap-6">
          <div className="relative shrink-0">
            <div className="h-28 w-28 rounded-3xl border-4 border-white bg-slate-100 overflow-hidden shadow-xl flex items-center justify-center">
               <span className="text-3xl font-black text-green-600">
                 {formData.full_name.charAt(0)}
               </span>
            </div>
            {isEditing && (
              <button className="absolute bottom-0 right-0 p-2 bg-green-600 text-white rounded-xl shadow-lg border-2 border-white hover:bg-green-700 transition-colors">
                <Camera size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-1 flex-row items-center justify-between pt-12">
             <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">{formData.full_name}</h1>
                    <ShieldCheck size={20} className="text-green-500" />
                </div>
                <p className="text-slate-500 font-bold text-xs flex items-center gap-1.5 mt-0.5">
                    <Briefcase size={14} className="text-green-600" /> {formData.role} Account
                </p>
             </div>

             <div className="flex gap-2">
                {!isEditing ? (
                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                        <Edit2 size={16} className="text-green-600" /> Edit
                    </button>
                ) : (
                    <>
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95">
                            <X size={16} />
                        </button>
                        <button onClick={handleSave} className="px-5 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-900/20 transition-all active:scale-95">
                            {isLoading ? '...' : <Save size={16} />}
                        </button>
                    </>
                )}
             </div>
          </div>
        </div>

        {/* --- Main Content Flow --- */}
        <div className="flex flex-col gap-4">
          
          {/* Personal Details Section */}
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
              <User size={18} className="text-green-600" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Personal Details</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-wider">Full Name</label>
                <input 
                  type="text" 
                  name="full_name" 
                  value={formData.full_name} 
                  onChange={handleChange} 
                  disabled={!isEditing} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-semibold focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-60 transition-all" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                    type="email" 
                    value={formData.email} 
                    disabled 
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-2xl text-slate-400 font-semibold cursor-not-allowed outline-none" 
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Settings Section */}
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
              <SettingsIcon size={18} className="text-green-600" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">Preferences</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <Languages size={14} /> App Language
                </label>
                <select 
                  name="language" 
                  value={formData.language} 
                  onChange={handleChange} 
                  disabled={!isEditing} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-semibold focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-60 cursor-pointer transition-all"
                >
                  <option>English</option>
                  <option>Hindi</option>
                  <option>Spanish</option>
                </select>
              </div>

              <div className="bg-slate-50/50 rounded-2xl p-4 space-y-4 border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic2 size={18} className="text-green-600" />
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Voice Interaction</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="voiceEnabled" 
                      checked={formData.voiceEnabled} 
                      onChange={handleChange} 
                      disabled={!isEditing} 
                      className="sr-only peer" 
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <Volume2 size={14} /> Teacher Persona
                  </label>
                  <select 
                    name="teacherMode" 
                    value={formData.teacherMode} 
                    onChange={handleChange} 
                    disabled={!isEditing} 
                    className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl text-slate-900 font-semibold focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-60 cursor-pointer transition-all text-sm"
                  >
                    <option>Encouraging</option>
                    <option>Strict</option>
                    <option>Casual</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;