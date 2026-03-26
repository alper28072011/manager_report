import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { QueryTemplate, Hotel, OperationType, ReportView, ColumnDefinition } from '../types';
import { handleFirestoreError } from '../utils/errorHandling';
import { TrendingUp, Loader2, Building2, Filter, Database, Table as TableIcon, Save, Columns, Check, Trash2, X, ChevronDown } from 'lucide-react';

export const ReportDashboard = ({ hotels }: { hotels: Hotel[] }) => {
  const [selectedHotel, setSelectedHotel] = useState<string>(hotels[0]?.hotel_code || '');
  const [queries, setQueries] = useState<QueryTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Dinamik parametreler için state
  const [parameters, setParameters] = useState<Record<string, string>>({});
  
  // Sorgu sonuçlarını tutacağımız state (Query Name -> Data Array)
  const [queryResults, setQueryResults] = useState<Record<string, any[]>>({});

  // Görünüm (View) ve Kolon Yönetimi State'leri
  const [savedViews, setSavedViews] = useState<ReportView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [saveMode, setSaveMode] = useState<'new' | 'update'>('new');
  
  const [availableColumns, setAvailableColumns] = useState<Record<string, string[]>>({});
  const [visibleColumns, setVisibleColumns] = useState<Record<string, string[]>>({});
  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);

  if (error) throw error;

  // Aktif sorguları getir
  useEffect(() => {
    const q = query(collection(db, 'queries'), where('is_active', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: QueryTemplate[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as QueryTemplate));
      setQueries(data);
    }, (err) => {
      try { handleFirestoreError(err, OperationType.LIST, 'queries'); }
      catch (e) { setError(e as Error); }
    });
    return () => unsubscribe();
  }, []);

  // Kayıtlı görünümleri getir
  useEffect(() => {
    if (!selectedHotel) return;
    const q = query(collection(db, 'report_views'), where('hotel_code', '==', selectedHotel));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: ReportView[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as ReportView));
      setSavedViews(data);
    }, (err) => {
      console.error("Görünümler çekilirken hata:", err);
    });
    return () => unsubscribe();
  }, [selectedHotel]);

  // Tüm aktif sorguların payload'larındaki eşsiz değişkenleri bul
  const dynamicVars = useMemo(() => {
    const allVars = new Set<string>();
    queries.forEach(q => {
      if (!q.payload_template) return;
      const regex = /\{\{(.*?)\}\}/g;
      const matches = [...q.payload_template.matchAll(regex)].map(m => m[1]);
      matches.forEach(v => allVars.add(v));
    });
    
    // Sistem değişkenlerini hariç tut
    const systemVars = ['HOTEL_ID', 'API_OBJECT'];
    systemVars.forEach(v => allVars.delete(v));
    
    return Array.from(allVars);
  }, [queries]);

  // Değişkenler değiştiğinde parametre state'ini hazırla (sadece yeni eklenenler için)
  useEffect(() => {
    setParameters(prev => {
      const newParams = { ...prev };
      let changed = false;
      dynamicVars.forEach(v => {
        if (newParams[v] === undefined) {
          newParams[v] = '';
          changed = true;
        }
      });
      return changed ? newParams : prev;
    });
  }, [dynamicVars]);

  const handleParamChange = (key: string, value: string) => {
    setParameters(prev => ({ ...prev, [key]: value }));
  };

  const handleLoadView = (viewId: string) => {
    setSelectedViewId(viewId);
    if (!viewId) return;
    
    const view = savedViews.find(v => v.id === viewId);
    if (view) {
      setParameters(view.parameters || {});
      setVisibleColumns(view.visible_columns || {});
    }
  };

  const handleSaveView = async () => {
    if (!newViewName.trim()) {
      alert("Lütfen bir görünüm adı girin.");
      return;
    }
    try {
      if (saveMode === 'update' && selectedViewId) {
        await updateDoc(doc(db, 'report_views', selectedViewId), {
          name: newViewName,
          parameters,
          visible_columns: visibleColumns,
          updated_at: serverTimestamp()
        });
      } else {
        const docRef = await addDoc(collection(db, 'report_views'), {
          name: newViewName,
          hotel_code: selectedHotel,
          parameters,
          visible_columns: visibleColumns,
          created_at: serverTimestamp()
        });
        setSelectedViewId(docRef.id);
      }
      setShowSaveModal(false);
      setNewViewName('');
    } catch (err: any) {
      alert("Görünüm kaydedilirken hata oluştu: " + err.message);
    }
  };

  const openSaveModal = () => {
    if (selectedViewId) {
      const currentView = savedViews.find(v => v.id === selectedViewId);
      setNewViewName(currentView?.name || '');
      setSaveMode('update');
    } else {
      setNewViewName('');
      setSaveMode('new');
    }
    setShowSaveModal(true);
  };

  const handleDeleteView = async (viewId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Bu görünümü silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, 'report_views', viewId));
      if (selectedViewId === viewId) setSelectedViewId('');
    } catch (err: any) {
      alert("Silinirken hata oluştu: " + err.message);
    }
  };

  const handleToggleColumn = (queryName: string, col: string) => {
    setVisibleColumns(prev => {
      const current = prev[queryName] || availableColumns[queryName] || [];
      if (current.includes(col)) {
        return { ...prev, [queryName]: current.filter(c => c !== col) };
      } else {
        // Orijinal sırayı korumak için availableColumns üzerinden filtreleme yapıyoruz
        const newCols = [...current, col];
        const sortedCols = (availableColumns[queryName] || []).filter(c => newCols.includes(c));
        return { ...prev, [queryName]: sortedCols };
      }
    });
  };

  const fetchData = async () => {
    if (!selectedHotel) return;
    const hotel = hotels.find(h => h.hotel_code === selectedHotel);
    if (!hotel || !hotel.api_key) {
      alert("Seçili otelin API anahtarı bulunamadı.");
      return;
    }

    setLoading(true);
    const newResults: Record<string, any[]> = {};
    const newAvailableCols: Record<string, string[]> = {};
    
    try {
      const queryPromises = queries.map(async (q) => {
        let payloadString = q.payload_template || "{}";
        
        // 1. Sistem Değişkenlerini Değiştir
        payloadString = payloadString.replace(/\{\{HOTEL_ID\}\}/g, hotel.hotel_code);
        payloadString = payloadString.replace(/\{\{API_OBJECT\}\}/g, q.api_object || "");
        
        // 2. Kullanıcı Parametrelerini Değiştir
        dynamicVars.forEach(v => {
          const val = parameters[v] || "";
          payloadString = payloadString.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), val);
        });

        try {
          // JSON formatını doğrula ama orijinal string'i gönder
          JSON.parse(payloadString);
          const response = await fetch(q.api_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': hotel.api_key.trim()
            },
            body: payloadString
          });

          if (!response.ok) {
            let errorDetail = response.statusText;
            try {
              const errBody = await response.text();
              if (errBody) {
                errorDetail += ` | Detay: ${errBody.substring(0, 200)}`;
              }
            } catch (e) {}
            throw new Error(`Status: ${response.status} - ${errorDetail}`);
          }

          const contentType = response.headers.get("content-type");
          let responseData;
          if (contentType && contentType.indexOf("application/json") !== -1) {
            responseData = await response.json();
          } else {
            responseData = await response.text();
            try { responseData = JSON.parse(responseData); } catch(e) {}
          }
          
          let tableData = [];
          if (Array.isArray(responseData)) {
            if (responseData.length > 0 && Array.isArray(responseData[0])) {
              tableData = responseData.flat();
            } else {
              tableData = responseData;
            }
          } else {
            tableData = responseData.data || responseData.items || [responseData];
          }
          
          newResults[q.query_name] = tableData;
          
          // Kolonları belirle
          if (tableData.length > 0 && typeof tableData[0] === 'object' && tableData[0] !== null) {
            newAvailableCols[q.query_name] = Object.keys(tableData[0]);
          } else {
            newAvailableCols[q.query_name] = ['Değer'];
          }
          
          return { queryName: q.query_name, success: true };
        } catch (error: any) {
          console.error(`Query failed: ${q.query_name}`, error);
          newResults[q.query_name] = [{ error: error.message || "Bilinmeyen bir hata oluştu" }];
          newAvailableCols[q.query_name] = ['error'];
          return { queryName: q.query_name, success: false, error: error.message };
        }
      });

      await Promise.all(queryPromises);
      setQueryResults(newResults);
      setAvailableColumns(newAvailableCols);
      
      // Eğer visibleColumns içinde bu sorgu için ayar yoksa, hepsini görünür yap
      setVisibleColumns(prev => {
        const updated = { ...prev };
        Object.keys(newAvailableCols).forEach(qName => {
          if (!updated[qName] || updated[qName].length === 0) {
            updated[qName] = newAvailableCols[qName];
          }
        });
        return updated;
      });
      
    } catch (err: any) {
      console.error(err);
      alert(`Veri çekilirken genel bir hata oluştu: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Dışarı tıklayınca menüyü kapatmak için
  useEffect(() => {
    const handleClickOutside = () => setOpenColumnMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Yönetim Raporları (BI)</h2>
          <p className="text-sm text-slate-500 mt-1">Tüm veri setlerinizi tek bir noktadan parametrik olarak sorgulayın ve analiz edin.</p>
        </div>
        
        {/* Kayıtlı Görünümler Dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-[200px]">
            <select 
              value={selectedViewId} 
              onChange={e => handleLoadView(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 bg-white appearance-none shadow-sm"
            >
              <option value="">-- Kayıtlı Görünüm Seç --</option>
              {savedViews.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {selectedViewId && (
            <button 
              onClick={(e) => handleDeleteView(selectedViewId, e)}
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              title="Seçili Görünümü Sil"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Üst Kontrol ve Filtre Paneli */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-5">
        <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
          <div className="w-full md:w-1/3">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Otel Seçimi</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building2 size={18} className="text-slate-400" />
              </div>
              <select 
                value={selectedHotel} 
                onChange={e => setSelectedHotel(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              >
                {hotels.map(h => <option key={h.id} value={h.hotel_code}>{h.name} ({h.hotel_code})</option>)}
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={openSaveModal}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm"
            >
              <Save size={18} />
              <span className="hidden sm:inline">Görünümü Kaydet</span>
            </button>
            <button 
              onClick={fetchData} 
              disabled={loading || queries.length === 0} 
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-70"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <TrendingUp size={18} />}
              Verileri Getir
            </button>
          </div>
        </div>

        {/* Dinamik Parametreler */}
        {dynamicVars.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={16} className="text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-700">Rapor Parametreleri</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {dynamicVars.map(variable => {
                // Veri türünü tanımlardan veya isimden tahmin et
                const paramDef = queries.flatMap(q => q.parameter_definitions || []).find(p => p.name === variable);
                
                const isDateDefined = queries.some(q => 
                  q.column_definitions?.some(cd => 
                    (cd.name === variable || cd.label === variable) && cd.type === 'date'
                  )
                );
                
                const isDate = paramDef?.type === 'date' || isDateDefined || 
                               variable.toLowerCase().includes('tarih') || 
                               variable.toLowerCase().includes('date') || 
                               variable.toLowerCase().includes('baslangic') || 
                               variable.toLowerCase().includes('bitis') ||
                               variable.toLowerCase().includes('from') ||
                               variable.toLowerCase().includes('to');
                
                const isNumber = paramDef?.type === 'number';
                const label = paramDef?.label || variable;
                
                return (
                  <div key={variable}>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
                    <input
                      type={isDate ? "date" : isNumber ? "number" : "text"}
                      value={parameters[variable] || ''}
                      onChange={(e) => handleParamChange(variable, e.target.value)}
                      placeholder={`${label} girin...`}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Veri Setleri (Query Results) */}
      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 space-y-4">
          <Loader2 size={48} className="animate-spin text-indigo-600" />
          <p className="text-slate-500 font-medium">Tüm veri setleri çekiliyor, lütfen bekleyin...</p>
        </div>
      ) : Object.keys(queryResults).length > 0 ? (
        <div className="space-y-6">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
            <Database className="text-indigo-600 mt-0.5" size={20} />
            <div>
              <h4 className="text-sm font-semibold text-indigo-900">Veri Setleri Hazır</h4>
              <p className="text-sm text-indigo-700 mt-1">
                Aşağıda sorgularınızdan dönen ham veri setlerinin önizlemeleri bulunmaktadır. Sütunları yöneterek istediğiniz görünümü oluşturabilir ve kaydedebilirsiniz.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {Object.entries(queryResults).map(([queryName, rawData], index) => {
              const data = Array.isArray(rawData) ? rawData : [];
              const isError = data.length === 1 && data[0].error;
              const queryDef = queries.find(q => q.query_name === queryName);
              const allCols = availableColumns[queryName] || [];
              const colsToRender = visibleColumns[queryName] || allCols;

              return (
                <div key={index} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                        <TableIcon size={18} className="text-indigo-600" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-800">{queryName}</h3>
                      {!isError && (
                        <span className="ml-2 text-xs font-medium bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full">
                          {data.length} Satır
                        </span>
                      )}
                    </div>
                    
                    {!isError && allCols.length > 0 && (
                      <div className="relative">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenColumnMenu(openColumnMenu === queryName ? null : queryName);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Columns size={16} className="text-slate-500" />
                          Sütunlar
                        </button>
                        
                        {openColumnMenu === queryName && (
                          <div 
                            className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-10 overflow-hidden"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="p-3 border-b border-slate-100 bg-slate-50">
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gösterilecek Sütunlar</h4>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-2">
                              {allCols.map(col => {
                                const isVisible = colsToRender.includes(col);
                                const colDef = queryDef?.column_definitions?.find(cd => cd.name === col);
                                const label = colDef?.label || col;
                                
                                return (
                                  <label key={col} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isVisible ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                      {isVisible && <Check size={14} className="text-white" />}
                                    </div>
                                    <input 
                                      type="checkbox" 
                                      className="hidden"
                                      checked={isVisible}
                                      onChange={() => handleToggleColumn(queryName, col)}
                                    />
                                    <span className="text-sm text-slate-700 truncate">{label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-0 overflow-x-auto max-h-[500px]">
                    {isError ? (
                      <div className="p-6 text-rose-600 text-sm font-medium bg-rose-50">
                        Hata: {data[0].error}
                      </div>
                    ) : data.length > 0 ? (
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-white sticky top-0 shadow-sm z-0">
                          <tr>
                            {colsToRender.map((col, i) => {
                              const colDef = queryDef?.column_definitions?.find(cd => cd.name === col);
                              const label = colDef?.label || col;
                              const isNumber = colDef?.type === 'number';
                              const isDate = colDef?.type === 'date';
                              
                              return (
                                <th key={i} scope="col" className={`px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${isNumber ? 'text-right' : isDate ? 'text-center' : 'text-left'}`}>
                                  {label}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {data.slice(0, 50).map((row, rowIndex) => (
                            <tr key={rowIndex} className="hover:bg-slate-50 transition-colors">
                              {colsToRender.map((col, colIndex) => {
                                const cellValue = typeof row === 'object' && row !== null ? row[col] : row;
                                const colDef = queryDef?.column_definitions?.find(cd => cd.name === col);
                                const isNumber = colDef?.type === 'number';
                                const isDate = colDef?.type === 'date';
                                
                                let displayValue = typeof cellValue === 'object' ? JSON.stringify(cellValue) : String(cellValue ?? '-');
                                
                                // Sayı formatlama
                                if (isNumber && typeof cellValue === 'number') {
                                  displayValue = new Intl.NumberFormat('tr-TR').format(cellValue);
                                }
                                
                                // Tarih formatlama
                                if (isDate && cellValue) {
                                  try {
                                    const date = new Date(cellValue);
                                    if (!isNaN(date.getTime())) {
                                      displayValue = new Intl.DateTimeFormat('tr-TR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric'
                                      }).format(date);
                                    }
                                  } catch (e) {
                                    // Fallback
                                  }
                                  
                                  if (displayValue === String(cellValue)) {
                                    const str = String(cellValue);
                                    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
                                    if (match) {
                                      displayValue = `${match[3]}.${match[2]}.${match[1]}`;
                                    }
                                  }
                                }

                                return (
                                  <td key={colIndex} className={`px-6 py-3 whitespace-nowrap text-sm text-slate-600 ${isNumber ? 'text-right font-mono' : isDate ? 'text-center' : 'text-left'}`}>
                                    <div className="max-w-xs truncate" title={displayValue}>
                                      {displayValue}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-8 text-center text-slate-500 text-sm">
                        Bu veri seti için kayıt bulunamadı.
                      </div>
                    )}
                  </div>
                  {!isError && data.length > 50 && (
                    <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 font-medium">
                      Sadece ilk 50 kayıt gösterilmektedir.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <Database size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Veri Setleri Bekleniyor</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Yukarıdaki parametreleri doldurup "Verileri Getir" butonuna tıklayarak tüm aktif sorgularınızı çalıştırabilir ve veri setlerinizi görüntüleyebilirsiniz.
          </p>
        </div>
      )}

      {/* Görünüm Kaydetme Modalı */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {saveMode === 'update' ? 'Görünümü Güncelle' : 'Yeni Görünüm Kaydet'}
              </h3>
              <button onClick={() => setShowSaveModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 space-y-5">
              {selectedViewId && (
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  <button 
                    onClick={() => setSaveMode('update')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${saveMode === 'update' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Üzerine Yaz
                  </button>
                  <button 
                    onClick={() => {
                      setSaveMode('new');
                      setNewViewName(newViewName + " (Kopya)");
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${saveMode === 'new' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Farklı Kaydet
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Görünüm Adı</label>
                <input 
                  type="text" 
                  value={newViewName}
                  onChange={e => setNewViewName(e.target.value)}
                  placeholder="Örn: Aylık Yönetim Özeti"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                />
              </div>
              
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                <p className="text-xs text-indigo-700 leading-relaxed">
                  {saveMode === 'update' 
                    ? "Mevcut görünümün parametreleri ve sütun ayarları güncellenecektir." 
                    : "Şu anki ayarlarınız yeni bir şablon olarak kaydedilecektir."}
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={handleSaveView}
                disabled={!newViewName.trim()}
                className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
              >
                {saveMode === 'update' ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
