import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, BarChart3, Settings2 } from 'lucide-react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError } from '../utils/errorHandling';
import { OperationType } from '../types';

interface HotelParameter {
  id?: string;
  hotel_id: string;
  param_key: string;
  param_value: string;
  param_type: string;
}

interface CalculatedMeasure {
  id?: string;
  hotel_id: string;
  measure_name: string;
  formula: string;
  format_type: string;
}

export const HotelSettings = () => {
  const [parameters, setParameters] = useState<HotelParameter[]>([]);
  const [measures, setMeasures] = useState<CalculatedMeasure[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [hotelId, setHotelId] = useState<string>('');

  // Yeni parametre state
  const [newParam, setNewParam] = useState<Partial<HotelParameter>>({
    param_key: '',
    param_value: '',
    param_type: 'number'
  });

  // Yeni formül state
  const [newMeasure, setNewMeasure] = useState<Partial<CalculatedMeasure>>({
    measure_name: '',
    formula: '',
    format_type: 'number'
  });

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const hotelsSnap = await getDocs(collection(db, 'hotels'));
        const fetchedHotels: any[] = hotelsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setHotels(fetchedHotels);
        if (fetchedHotels.length > 0) {
          setHotelId(fetchedHotels[0].hotel_code);
        }
      } catch (error) {
        console.error("Error fetching hotels:", error);
      }
    };
    fetchHotels();
  }, []);

  useEffect(() => {
    if (!hotelId) return;
    const fetchData = async () => {
      try {
        const paramsQuery = query(collection(db, 'hotel_parameters'), where('hotel_id', '==', hotelId));
        const paramsSnap = await getDocs(paramsQuery);
        setParameters(paramsSnap.docs.map(d => ({ id: d.id, ...d.data() } as HotelParameter)));

        const measuresQuery = query(collection(db, 'calculated_measures'), where('hotel_id', '==', hotelId));
        const measuresSnap = await getDocs(measuresQuery);
        setMeasures(measuresSnap.docs.map(d => ({ id: d.id, ...d.data() } as CalculatedMeasure)));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'hotel_parameters/calculated_measures');
      }
    };
    fetchData();
  }, [hotelId]);

  const handleAddParameter = async () => {
    if (newParam.param_key && newParam.param_value) {
      try {
        const paramData = {
          hotel_id: hotelId,
          param_key: newParam.param_key,
          param_value: newParam.param_value,
          param_type: newParam.param_type || 'number',
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'hotel_parameters'), paramData);
        setParameters([...parameters, { id: docRef.id, ...paramData } as HotelParameter]);
        setNewParam({ param_key: '', param_value: '', param_type: 'number' });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'hotel_parameters');
      }
    }
  };

  const handleDeleteParameter = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'hotel_parameters', id));
      setParameters(parameters.filter(p => p.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `hotel_parameters/${id}`);
    }
  };

  const handleAddMeasure = async () => {
    if (newMeasure.measure_name && newMeasure.formula) {
      try {
        const measureData = {
          hotel_id: hotelId,
          measure_name: newMeasure.measure_name,
          formula: newMeasure.formula,
          format_type: newMeasure.format_type || 'number',
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'calculated_measures'), measureData);
        setMeasures([...measures, { id: docRef.id, ...measureData } as CalculatedMeasure]);
        setNewMeasure({ measure_name: '', formula: '', format_type: 'number' });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'calculated_measures');
      }
    }
  };

  const handleDeleteMeasure = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'calculated_measures', id));
      setMeasures(measures.filter(m => m.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `calculated_measures/${id}`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-indigo-600" />
            Otel Ayarları & Hesaplama Motoru
          </h1>
          <p className="text-slate-500 mt-1">
            Otelinize ait sabit parametreleri tanımlayın ve bu parametreleri kullanarak özel hesaplanmış metrikler (DAX benzeri) oluşturun.
          </p>
        </div>
        <div className="w-64">
          <label className="block text-xs font-medium text-slate-500 mb-1">Otel Seçimi</label>
          <select
            value={hotelId}
            onChange={(e) => setHotelId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {hotels.map(h => (
              <option key={h.id} value={h.hotel_code}>{h.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Parametreler Bölümü */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-slate-500" />
              Otel Parametreleri
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3 items-end bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Parametre Adı (Key)</label>
                <input
                  type="text"
                  placeholder="Örn: ROOM_CAPACITY"
                  value={newParam.param_key}
                  onChange={e => setNewParam({...newParam, param_key: e.target.value.toUpperCase()})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Değer (Value)</label>
                <input
                  type="text"
                  placeholder="Örn: 402"
                  value={newParam.param_value}
                  onChange={e => setNewParam({...newParam, param_value: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="w-32">
                <label className="block text-xs font-medium text-slate-500 mb-1">Tip</label>
                <select
                  value={newParam.param_type}
                  onChange={e => setNewParam({...newParam, param_type: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="number">Sayı</option>
                  <option value="date">Tarih</option>
                  <option value="text">Metin</option>
                </select>
              </div>
              <button
                onClick={handleAddParameter}
                disabled={!newParam.param_key || !newParam.param_value}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Ekle
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Anahtar</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Değer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tip</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">İşlem</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {parameters.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                        Henüz parametre eklenmemiş.
                      </td>
                    </tr>
                  ) : (
                    parameters.map((param) => (
                      <tr key={param.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{param.param_key}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{param.param_value}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                            {param.param_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          <button
                            onClick={() => param.id && handleDeleteParameter(param.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Hesaplanmış Metrikler Bölümü */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-500" />
              Hesaplanmış Metrikler (Measures)
            </h2>
          </div>

          <div className="space-y-4">
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-4">
              <h4 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-2">Kullanılabilir Değişkenler</h4>
              <div className="flex flex-wrap gap-2">
                {parameters.map(p => (
                  <span key={p.id} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono bg-white border border-indigo-200 text-indigo-700">
                    {p.param_key}
                  </span>
                ))}
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono bg-white border border-slate-200 text-slate-600">
                  API_SUTUN_ADLARI
                </span>
              </div>
              <p className="text-xs text-indigo-600 mt-2">
                Formül yazarken yukarıdaki parametreleri ve API'den dönen sütun adlarını (örn: ROOM, REVENUE) kullanabilirsiniz.
              </p>
            </div>

            <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Metrik Adı</label>
                  <input
                    type="text"
                    placeholder="Örn: Oda Doluluk Oranı"
                    value={newMeasure.measure_name}
                    onChange={e => setNewMeasure({...newMeasure, measure_name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="w-40">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Format</label>
                  <select
                    value={newMeasure.format_type}
                    onChange={e => setNewMeasure({...newMeasure, format_type: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="number">Sayı</option>
                    <option value="percentage">Yüzde (%)</option>
                    <option value="currency">Para Birimi</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Formül (Pandas Eval Formatı)</label>
                <div className="flex gap-3 items-start">
                  <input
                    type="text"
                    placeholder="Örn: (ROOM / ROOM_CAPACITY) * 100"
                    value={newMeasure.formula}
                    onChange={e => setNewMeasure({...newMeasure, formula: e.target.value})}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    onClick={handleAddMeasure}
                    disabled={!newMeasure.measure_name || !newMeasure.formula}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Ekle
                  </button>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Metrik Adı</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Formül</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Format</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">İşlem</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {measures.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                        Henüz hesaplanmış metrik eklenmemiş.
                      </td>
                    </tr>
                  ) : (
                    measures.map((measure) => (
                      <tr key={measure.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{measure.measure_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-mono text-xs">{measure.formula}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                            {measure.format_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          <button
                            onClick={() => measure.id && handleDeleteMeasure(measure.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
