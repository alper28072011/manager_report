import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Hotel, OperationType } from '../types';
import { handleFirestoreError } from '../utils/errorHandling';
import { Edit2, Save, X } from 'lucide-react';

export const UserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ role: 'super_admin' | 'user', allowed_hotels: string[] }>({ role: 'user', allowed_hotels: [] });

  if (error) throw error;

  useEffect(() => {
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const data: UserProfile[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as UserProfile));
      setUsers(data);
    }, (err) => {
      try { handleFirestoreError(err, OperationType.LIST, 'users'); }
      catch (e) { setError(e as Error); }
    });

    const qHotels = query(collection(db, 'hotels'));
    const unsubHotels = onSnapshot(qHotels, (snapshot) => {
      const data: Hotel[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Hotel));
      setHotels(data);
      setLoading(false);
    }, (err) => {
      try { handleFirestoreError(err, OperationType.LIST, 'hotels'); }
      catch (e) { setError(e as Error); }
    });

    return () => { unsubUsers(); unsubHotels(); };
  }, []);

  const handleEdit = (user: UserProfile) => {
    setEditData({ role: user.role, allowed_hotels: user.allowed_hotels || [] });
    setEditingId(user.id);
  };

  const handleSave = async (id: string) => {
    try {
      await updateDoc(doc(db, 'users', id), { ...editData, updatedAt: serverTimestamp() });
      setEditingId(null);
    } catch (err) {
      try { handleFirestoreError(err, OperationType.UPDATE, `users/${id}`); }
      catch (e) { setError(e as Error); }
    }
  };

  const toggleHotel = (hotelCode: string) => {
    setEditData(prev => {
      const isSelected = prev.allowed_hotels.includes(hotelCode);
      if (isSelected) {
        return { ...prev, allowed_hotels: prev.allowed_hotels.filter(c => c !== hotelCode) };
      } else {
        return { ...prev, allowed_hotels: [...prev.allowed_hotels, hotelCode] };
      }
    });
  };

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Kullanıcı Yönetimi</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-3 px-4 text-sm font-semibold text-slate-600">E-posta</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-600">Rol</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-600">İzin Verilen Oteller</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4 text-sm text-slate-800 font-medium">{user.email}</td>
                <td className="py-3 px-4 text-sm">
                  {editingId === user.id ? (
                    <select value={editData.role} onChange={e => setEditData({...editData, role: e.target.value as any})} className="border border-slate-300 rounded px-2 py-1 text-sm">
                      <option value="user">Kullanıcı</option>
                      <option value="super_admin">Süper Admin</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {user.role === 'super_admin' ? 'Süper Admin' : 'Kullanıcı'}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-sm">
                  {editingId === user.id ? (
                    <div className="flex flex-wrap gap-2">
                      {hotels.map(h => (
                        <label key={h.id} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs cursor-pointer">
                          <input type="checkbox" checked={editData.allowed_hotels.includes(h.hotel_code)} onChange={() => toggleHotel(h.hotel_code)} />
                          {h.name} ({h.hotel_code})
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {user.allowed_hotels?.map(code => {
                        const h = hotels.find(ht => ht.hotel_code === code);
                        return <span key={code} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">{h ? h.name : code}</span>;
                      })}
                      {(!user.allowed_hotels || user.allowed_hotels.length === 0) && <span className="text-slate-400 italic text-xs">Otel atanmadı</span>}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 flex justify-end gap-2">
                  {editingId === user.id ? (
                    <>
                      <button onClick={() => handleSave(user.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Save size={16} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-600 hover:bg-slate-50 rounded-lg"><X size={16} /></button>
                    </>
                  ) : (
                    <button onClick={() => handleEdit(user)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
