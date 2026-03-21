import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { QueryTemplate, OperationType, Hotel } from '../types';
import { handleFirestoreError } from '../utils/errorHandling';
import { Edit2, Play, Trash2, CheckCircle2, XCircle, Terminal, Save, X } from 'lucide-react';

export const QuerySettingsPanel = ({ hotels }: { hotels: Hotel[] }) => {
  const [queries, setQueries] = useState<QueryTemplate[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [formData, setFormData] = useState({
    query_name: '',
    api_url: 'https://4001.hoteladvisor.net',
    api_object: '',
    payload_template: '{\n  "Action": "Execute",\n  "Object": "{{API_OBJECT}}",\n  "Parameters": {\n    "HOTELID": "{{HOTEL_ID}}",\n    "FROM": "{{REPORT_START_DATE}}",\n    "TO": "{{REPORT_END_DATE}}"\n  },\n  "Where": []\n}',
    response_index: 0,
    is_active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Test state
  const [testHotelCode, setTestHotelCode] = useState(hotels[0]?.hotel_code || '');
  const [previewState, setPreviewState] = useState<{ isOpen: boolean; loading: boolean; data: any | null; queryName: string }>({
    isOpen: false, loading: false, data: null, queryName: ''
  });
  
  if (error) throw error;

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'queries'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const queriesData: QueryTemplate[] = [];
      snapshot.forEach((doc) => {
        queriesData.push({ id: doc.id, ...doc.data() } as QueryTemplate);
      });
      setQueries(queriesData);
      setIsLoading(false);
    }, (err) => {
      try { handleFirestoreError(err, OperationType.LIST, 'queries'); }
      catch (e) { setError(e as Error); }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'number' ? parseInt(value, 10) : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'queries', editingId), { ...formData, updatedAt: serverTimestamp() });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'queries'), { ...formData, createdAt: serverTimestamp() });
      }
      setFormData({ query_name: '', api_url: 'https://4001.hoteladvisor.net', api_object: '', payload_template: '{\n  "Action": "Execute",\n  "Object": "{{API_OBJECT}}",\n  "Parameters": {\n    "HOTELID": "{{HOTEL_ID}}",\n    "FROM": "{{REPORT_START_DATE}}",\n    "TO": "{{REPORT_END_DATE}}"\n  },\n  "Where": []\n}', response_index: 0, is_active: true });
      setIsSubmitting(false);
    } catch (err) {
      try { handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'queries'); }
      catch (e) { setError(e as Error); }
      setIsSubmitting(false);
    }
  };

  const handleEdit = (query: QueryTemplate) => {
    setFormData({
      query_name: query.query_name,
      api_url: query.api_url || 'https://4001.hoteladvisor.net',
      api_object: query.api_object,
      payload_template: query.payload_template,
      response_index: query.response_index,
      is_active: query.is_active
    });
    setEditingId(query.id);
  };

  const handleDelete = async (queryId: string) => {
    if (!window.confirm("Emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, 'queries', queryId));
    } catch (err) {
      try { handleFirestoreError(err, OperationType.DELETE, `queries/${queryId}`); }
      catch (e) { setError(e as Error); }
    }
  };

  const handleTest = async (queryToTest: typeof formData | QueryTemplate) => {
    const hotel = hotels.find(h => h.hotel_code === testHotelCode);
    if (!hotel) {
      alert("Lütfen test için bir otel seçin.");
      return;
    }
    
    const cleanApiKey = hotel.api_key.trim();
    if (/[^\x20-\x7E]/.test(cleanApiKey)) {
      alert("Seçili otelin API Anahtarında geçersiz karakterler var.");
      return;
    }

    setPreviewState({ isOpen: true, loading: true, data: null, queryName: queryToTest.query_name || 'Yeni Sorgu' });
    
    const simulatedPayload = queryToTest.payload_template
      .replace(/{{HOTEL_ID}}/g, hotel.hotel_code)
      .replace(/{{REPORT_START_DATE}}/g, "2026-01-01")
      .replace(/{{REPORT_END_DATE}}/g, "2026-12-31")
      .replace(/{{API_OBJECT}}/g, queryToTest.api_object || "");

    try {
      const response = await fetch(queryToTest.api_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': cleanApiKey },
        body: simulatedPayload
      });

      const contentType = response.headers.get("content-type");
      let responseData;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        setPreviewState({ 
          isOpen: true, loading: false, 
          data: { status: "HATA", statusCode: response.status, errorDetails: responseData }, 
          queryName: queryToTest.query_name || 'Yeni Sorgu' 
        });
        return;
      }

      setPreviewState({ 
        isOpen: true, loading: false, 
        data: { status: "BAŞARILI", statusCode: response.status, responseData: responseData }, 
        queryName: queryToTest.query_name || 'Yeni Sorgu' 
      });

    } catch (error: any) {
      setPreviewState({ 
        isOpen: true, loading: false, 
        data: { status: "AĞ HATASI", message: error.message }, 
        queryName: queryToTest.query_name || 'Yeni Sorgu' 
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Sorgu Şablonları</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Test Oteli:</span>
          <select value={testHotelCode} onChange={e => setTestHotelCode(e.target.value)} className="text-sm border border-slate-300 rounded-lg px-2 py-1">
            <option value="">Seçiniz...</option>
            {hotels.map(h => <option key={h.id} value={h.hotel_code}>{h.name} ({h.hotel_code})</option>)}
          </select>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sorgu Adı</label>
            <input required type="text" name="query_name" value={formData.query_name} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Örn: Ana Rezervasyon Küpü" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Endpoint URL</label>
            <input required type="url" name="api_url" value={formData.api_url} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">API Object (SP_...)</label>
            <input required type="text" name="api_object" value={formData.api_object} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Örn: SP_EASYPMS_PULLRESCUBE" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Response Array Index</label>
            <input required type="number" name="response_index" value={formData.response_index} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Payload Şablonu (JSON)</label>
            <textarea required name="payload_template" value={formData.payload_template} onChange={handleInputChange} rows={6} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => handleTest(formData)} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 flex items-center gap-2"><Play size={18} /> Test Et</button>
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"><Save size={18} /> {editingId ? 'Güncelle' : 'Kaydet'}</button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-3 px-4 text-sm font-semibold text-slate-600">Sorgu Adı</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-600">API Object</th>
              <th className="py-3 px-4 text-sm font-semibold text-slate-600 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {queries.map(q => (
              <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4 text-sm text-slate-800 font-medium">{q.query_name}</td>
                <td className="py-3 px-4 text-sm text-slate-600 font-mono">{q.api_object}</td>
                <td className="py-3 px-4 flex justify-end gap-2">
                  <button onClick={() => handleTest(q)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><Play size={16} /></button>
                  <button onClick={() => handleEdit(q)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(q.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewState.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Test Sonucu: {previewState.queryName}</h3>
              <button onClick={() => setPreviewState({ ...previewState, isOpen: false })} className="p-1 hover:bg-slate-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-900 text-slate-300 font-mono text-sm">
              {previewState.loading ? (
                <div className="flex items-center gap-3 text-indigo-400"><Terminal size={20} className="animate-pulse" /> İstek gönderiliyor...</div>
              ) : (
                <pre className="whitespace-pre-wrap">{JSON.stringify(previewState.data, null, 2)}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
