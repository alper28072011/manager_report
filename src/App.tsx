import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, onSnapshot, where } from 'firebase/firestore';
import { UserProfile, Hotel, OperationType } from './types';
import { handleFirestoreError } from './utils/errorHandling';

import { Login } from './components/Login';
import { HotelManagement } from './components/HotelManagement';
import { UserManagement } from './components/UserManagement';
import { QuerySettingsPanel } from './components/QuerySettingsPanel';
import { ReportDashboard } from './components/ReportDashboard';

import { LayoutDashboard, Settings, Users, Building2, LogOut, Loader2 } from 'lucide-react';

const AppContent = () => {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  if (error) throw error;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserProfile({ id: userSnap.id, ...userSnap.data() } as UserProfile);
          }
        } catch (err) {
          try { handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`); }
          catch (e) { setError(e as Error); }
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userProfile) return;

    let q;
    if (userProfile.role === 'super_admin') {
      q = query(collection(db, 'hotels'));
    } else {
      if (!userProfile.allowed_hotels || userProfile.allowed_hotels.length === 0) {
        setHotels([]);
        return;
      }
      // Firestore 'in' query supports up to 10 elements. Assuming allowed_hotels <= 10 for simplicity.
      q = query(collection(db, 'hotels'), where('hotel_code', 'in', userProfile.allowed_hotels));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Hotel[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Hotel));
      setHotels(data);
    }, (err) => {
      try { handleFirestoreError(err, OperationType.LIST, 'hotels'); }
      catch (e) { setError(e as Error); }
    });

    return () => unsubscribe();
  }, [userProfile]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 size={48} className="animate-spin text-indigo-600" /></div>;
  }

  if (!user || !userProfile) {
    return <Routes><Route path="*" element={<Login />} /></Routes>;
  }

  const isSuperAdmin = userProfile.role === 'super_admin';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-10">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-indigo-500 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/20">
            <Building2 size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Hotel Advisor</h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase mt-0.5">Raporlama Sistemi</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">Menü</div>
          
          <button onClick={() => navigate('/')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${location.pathname === '/' ? 'bg-indigo-600/10 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}>
            <LayoutDashboard size={20} /> Raporlar
          </button>

          {isSuperAdmin && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-8 mb-3 px-3">Yönetim</div>
              <button onClick={() => navigate('/hotels')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${location.pathname === '/hotels' ? 'bg-indigo-600/10 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}>
                <Building2 size={20} /> Oteller
              </button>
              <button onClick={() => navigate('/users')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${location.pathname === '/users' ? 'bg-indigo-600/10 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}>
                <Users size={20} /> Kullanıcılar
              </button>
              <button onClick={() => navigate('/queries')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${location.pathname === '/queries' ? 'bg-indigo-600/10 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}>
                <Settings size={20} /> Sorgu Şablonları
              </button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white">
              {userProfile.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userProfile.email}</p>
              <p className="text-xs text-slate-400 truncate">{isSuperAdmin ? 'Süper Admin' : 'Kullanıcı'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors">
            <LogOut size={18} /> Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50/50">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<ReportDashboard hotels={hotels} />} />
            {isSuperAdmin && (
              <>
                <Route path="/hotels" element={<HotelManagement />} />
                <Route path="/users" element={<UserManagement />} />
                <Route path="/queries" element={<QuerySettingsPanel hotels={hotels} />} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
