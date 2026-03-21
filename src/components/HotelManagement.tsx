import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Hotel, OperationType } from '../types';
import { handleFirestoreError } from '../utils/errorHandling';
import { Edit2, Save, X, Plus, Trash2 } from 'lucide-react';

export const HotelManagement = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const [formData, setFormData] = useState({
    hotel_code: '',
    name: '',
    api_key: '',
    is_active: true
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  if (error) throw error;

  useEffect(() => {
    const q = query(collection(db, 'hotels'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Hotel[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Hotel));
      setHotels(data);
      setLoading(false);
    }, (err) => {
      try { handleFirestoreError(err, OperationType.LIST, 'hotels'); }
      catch (e) { setError(e as Error); }
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'hotels', editingId), { ...formData, updatedAt: serverTimestamp() });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'hotels'), { ...formData, createdAt: serverTimestamp() });
      }
      setFormData({ hotel_code: '', name: '', api_key: '', is_active: true });
    } catch (err) {
      try { handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'hotels'); }
      catch (e) { setError(e as Error); }
    }
  };

  const handleEdit = (hotel: Hotel) => {
    setFormData({ hotel_code: hotel.hotel_code, name: hotel.name, api_key: hotel.api_key, is_active: hotel.is_active });
    setEditingId(hotel.id);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'hotels', id));
    } catch (err) {
      try { handleFirestoreError(err, OperationType.DELETE, `hotels/${id}`); }
      catch (e) { setError(e as Error); }
    }
  };

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Otel Yönetimi</h2>
      
      <form onSubmit={handleSubmit} className="mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Otel Kodu</label>
            <input required type="text" value={formData.hotel_code} onChange={e => setFormData({...formData, hotel_code: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Örn: 21390" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Otel Adı</label>
            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Örn: Grand Hotel" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">API Anahtarı</label>
            <input required type="text" value={formData.api_key} onChange={e => setFormData({...formData, api_key: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="API Key" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setFormData({ hotel_code: '', name: '', api_key: '', is_active: true }); }} className="px-4 py-2 text-slate-600 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors">İptal</button>
          )}
          <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            {editingId ? <Save size={18} /> : <Plus size={18} />}
            {editingId ? 'Güncelle' : 'Ekle'}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-3 px-4 text-sm font-semibold text-slate-600">Otel Kodu</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-600">Otel Adı</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-600">API Anahtarı</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {hotels.map(hotel => (
              <tr key={hotel.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4 text-sm text-slate-800 font-medium">{hotel.hotel_code}</td>
                <td className="py-3 px-4 text-sm text-slate-600">{hotel.name}</td>
                <td className="py-3 px-4 text-sm text-slate-500 font-mono truncate max-w-xs">{hotel.api_key.substring(0, 10)}...</td>
                <td className="py-3 px-4 flex justify-end gap-2">
                  <button onClick={() => handleEdit(hotel)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(hotel.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
