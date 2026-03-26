import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { QueryTemplate, OperationType, Hotel, ColumnDefinition, ParameterDefinition } from '../types';
import { handleFirestoreError } from '../utils/errorHandling';
import { Edit2, Play, Trash2, CheckCircle2, XCircle, Terminal, Save, X, Plus, Hash, Type, Calendar, CheckSquare, Sparkles, Settings2 } from 'lucide-react';

export const QuerySettingsPanel = ({ hotels }: { hotels: Hotel[] }) => {
  const [queries, setQueries] = useState<QueryTemplate[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [formData, setFormData] = useState({
    query_name: '',
    api_url: 'https://4001.hoteladvisor.net',
    api_object: '',
    payload_template: '{\n  "Action": "Execute",\n  "Object": "{{API_OBJECT}}",\n  "Parameters": {\n    "HOTELID": "{{HOTEL_ID}}",\n    "FROM": "{{REPORT_START_DATE}}",\n    "TO": "{{REPORT_END_DATE}}"\n  },\n  "Where": []\n}',
    response_index: 0,
    is_active: true,
    column_definitions: [] as ColumnDefinition[],
    parameter_definitions: [] as ParameterDefinition[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Test state
  const [testHotelCode, setTestHotelCode] = useState(hotels[0]?.hotel_code || '');
  const [testParams, setTestParams] = useState<Record<string, string>>({});
  const [previewState, setPreviewState] = useState<{ isOpen: boolean; loading: boolean; data: any | null; queryName: string }>({
    isOpen: false, loading: false, data: null, queryName: ''
  });
  
  if (error) throw error;

  // Mevcut şablondaki değişkenleri bul
  const currentVars = useMemo(() => {
    if (!formData.payload_template) return [];
    const regex = /\{\{(.*?)\}\}/g;
    const matches = [...formData.payload_template.matchAll(regex)].map(m => m[1]);
    const vars = Array.from(new Set(matches));
    return vars.filter(v => !['HOTEL_ID', 'API_OBJECT'].includes(v));
  }, [formData.payload_template]);

  // Değişkenler değiştiğinde test parametrelerini ve parametre tanımlarını güncelle
  useEffect(() => {
    setTestParams(prev => {
      const next = { ...prev };
      let changed = false;
      currentVars.forEach(v => {
        if (next[v] === undefined) {
          const isDate = v.toLowerCase().includes('tarih') || v.toLowerCase().includes('date') || v.toLowerCase().includes('baslangic') || v.toLowerCase().includes('bitis') || v.toLowerCase().includes('from') || v.toLowerCase().includes('to');
          next[v] = isDate ? new Date().toISOString().split('T')[0] : '';
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setFormData(prev => {
      const existingParams = prev.parameter_definitions || [];
      const newParams = currentVars.map(v => {
        const existing = existingParams.find(p => p.name === v);
        if (existing) return existing;
        const isDate = v.toLowerCase().includes('tarih') || v.toLowerCase().includes('date') || v.toLowerCase().includes('baslangic') || v.toLowerCase().includes('bitis') || v.toLowerCase().includes('from') || v.toLowerCase().includes('to');
        return { name: v, label: v, type: isDate ? 'date' : 'string' } as ParameterDefinition;
      });
      
      if (JSON.stringify(existingParams) !== JSON.stringify(newParams)) {
        return { ...prev, parameter_definitions: newParams };
      }
      return prev;
    });
  }, [currentVars]);

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
      setFormData({ 
        query_name: '', 
        api_url: 'https://4001.hoteladvisor.net', 
        api_object: '', 
        payload_template: '{\n  "Action": "Execute",\n  "Object": "{{API_OBJECT}}",\n  "Parameters": {\n    "HOTELID": "{{HOTEL_ID}}",\n    "FROM": "{{REPORT_START_DATE}}",\n    "TO": "{{REPORT_END_DATE}}"\n  },\n  "Where": []\n}', 
        response_index: 0, 
        is_active: true,
        column_definitions: [],
        parameter_definitions: []
      });
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
      is_active: query.is_active,
      column_definitions: query.column_definitions || [],
      parameter_definitions: query.parameter_definitions || []
    });
    setEditingId(query.id);
  };

  const updateParameter = (index: number, field: keyof ParameterDefinition, value: string) => {
    setFormData(prev => {
      const newParams = [...(prev.parameter_definitions || [])];
      newParams[index] = { ...newParams[index], [field]: value };
      return { ...prev, parameter_definitions: newParams };
    });
  };

  const addColumn = () => {
    setFormData(prev => ({
      ...prev,
      column_definitions: [...prev.column_definitions, { name: '', label: '', type: 'string' }]
    }));
  };

  const removeColumn = (index: number) => {
    setFormData(prev => ({
      ...prev,
      column_definitions: prev.column_definitions.filter((_, i) => i !== index)
    }));
  };

  const updateColumn = (index: number, field: keyof ColumnDefinition, value: string) => {
    setFormData(prev => {
      const newCols = [...prev.column_definitions];
      newCols[index] = { ...newCols[index], [field]: value };
      return { ...prev, column_definitions: newCols };
    });
  };

  const autoDetectColumns = (data: any) => {
    let sample: any = null;
    
    // Veriyi bulmaya çalış (responseData içinden)
    if (data && data.responseData) {
      let resp = data.responseData;
      
      // Eğer dizi içinde dizi geliyorsa (flat yap)
      if (Array.isArray(resp) && resp.length > 0 && Array.isArray(resp[0])) {
        resp = resp.flat();
      }

      if (Array.isArray(resp) && resp.length > 0) {
        sample = resp[0];
      } else if (typeof resp === 'object' && resp !== null) {
        // Tekil nesne gelmiş olabilir (data: { ... })
        sample = resp.data || resp.items || resp;
        if (Array.isArray(sample)) sample = sample[0];
      }
    }

    if (!sample || typeof sample !== 'object' || Array.isArray(sample)) {
      alert("Sütunları algılamak için geçerli bir veri nesnesi bulunamadı. Veri yapısını kontrol edin.");
      return;
    }

    const detected: ColumnDefinition[] = Object.entries(sample).map(([key, value]) => {
      let type: ColumnDefinition['type'] = 'string';
      if (typeof value === 'number') type = 'number';
      else if (typeof value === 'boolean') type = 'boolean';
      else if (typeof value === 'string' && !isNaN(Date.parse(value)) && value.length > 8) type = 'date';
      
      return {
        name: key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        type
      };
    });

    setFormData(prev => ({ ...prev, column_definitions: detected }));
    setPreviewState(prev => ({ ...prev, isOpen: false }));
    alert(`${detected.length} sütun başarıyla algılandı ve eklendi.`);
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
    
    let simulatedPayload = queryToTest.payload_template
      .replace(/{{HOTEL_ID}}/g, hotel.hotel_code)
      .replace(/{{API_OBJECT}}/g, queryToTest.api_object || "");

    // Tüm dinamik değişkenleri değiştir
    const regex = /\{\{(.*?)\}\}/g;
    simulatedPayload = simulatedPayload.replace(regex, (match, varName) => {
      if (varName === 'HOTEL_ID' || varName === 'API_OBJECT') return match;
      // Eğer testParams içinde varsa onu kullan, yoksa varsayılan tarih kullan
      return testParams[varName] || "2026-01-01";
    });

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
            <div className="relative">
              <textarea required name="payload_template" value={formData.payload_template} onChange={handleInputChange} rows={8} className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500" />
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Sistem Değişkenleri:</span>
                <code className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">{"{{HOTEL_ID}}"}</code>
                <code className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">{"{{API_OBJECT}}"}</code>
              </div>
            </div>
          </div>
        </div>

        {/* Test Parametreleri ve Veri Türleri Bölümü */}
        {currentVars.length > 0 && (
          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <Settings2 size={16} className="text-amber-600" />
              <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Parametre Veri Türleri & Test Değerleri</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formData.parameter_definitions?.map((param, idx) => (
                <div key={param.name} className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-lg border border-amber-100 shadow-sm">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">{param.name} (Etiket)</label>
                    <input 
                      type="text"
                      value={param.label}
                      onChange={e => updateParameter(idx, 'label', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="Görünen Ad"
                    />
                  </div>
                  <div className="w-full sm:w-32">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Veri Türü</label>
                    <select 
                      value={param.type}
                      onChange={e => updateParameter(idx, 'type', e.target.value as any)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-slate-50"
                    >
                      <option value="string">Metin</option>
                      <option value="number">Sayı</option>
                      <option value="date">Tarih</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-amber-700 mb-1 uppercase">Test Değeri</label>
                    <input 
                      type={param.type === 'date' ? 'date' : param.type === 'number' ? 'number' : 'text'}
                      value={testParams[param.name] || ''}
                      onChange={e => setTestParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                      className="w-full px-2 py-1.5 text-xs border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                      placeholder="Test değeri..."
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-amber-600 italic">
              * Bu parametre türleri, uygulamanın diğer bölümlerinde (Rapor Oluşturucu vb.) doğru veri giriş alanlarının (örn. tarih seçici) gösterilmesi için kullanılacaktır.
            </p>
          </div>
        )}

        {/* Sütun Tanımları Bölümü */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Terminal size={18} className="text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Sütun Veri Türleri</h3>
            </div>
            <button 
              type="button" 
              onClick={addColumn}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={14} /> Sütun Ekle
            </button>
          </div>
          
          <div className="space-y-3">
            {formData.column_definitions.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-sm text-slate-400">Henüz sütun tanımlanmamış. Test edip "Sütunları Algıla" butonunu kullanabilirsiniz.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {formData.column_definitions.map((col, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm items-center">
                    <div className="flex-1 w-full">
                      <input 
                        placeholder="Sütun Adı (API'den gelen)" 
                        value={col.name} 
                        onChange={e => updateColumn(idx, 'name', e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-mono"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <input 
                        placeholder="Görünen Etiket" 
                        value={col.label} 
                        onChange={e => updateColumn(idx, 'label', e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="w-full sm:w-40">
                      <div className="relative">
                        <select 
                          value={col.type} 
                          onChange={e => updateColumn(idx, 'type', e.target.value as any)}
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg appearance-none bg-slate-50"
                        >
                          <option value="string">Metin</option>
                          <option value="number">Sayı</option>
                          <option value="date">Tarih</option>
                          <option value="boolean">Mantıksal</option>
                        </select>
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                          {col.type === 'number' && <Hash size={14} />}
                          {col.type === 'string' && <Type size={14} />}
                          {col.type === 'date' && <Calendar size={14} />}
                          {col.type === 'boolean' && <CheckSquare size={14} />}
                        </div>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => removeColumn(idx)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
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
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-slate-800">Test Sonucu: {previewState.queryName}</h3>
                {!previewState.loading && previewState.data?.status === "BAŞARILI" && (
                  <button 
                    onClick={() => autoDetectColumns(previewState.data)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-200"
                  >
                    <Sparkles size={14} /> Sütunları Algıla
                  </button>
                )}
              </div>
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
