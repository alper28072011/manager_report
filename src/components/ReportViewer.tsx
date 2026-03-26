import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { QueryTemplate, Hotel, ReportDefinition, ReportArea, OperationType } from '../types';
import { handleFirestoreError } from '../utils/errorHandling';
import { Loader2, Play, Table as TableIcon, BarChart3, LineChart, PieChart, Printer, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart as RechartsLineChart, Line, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export const ReportViewer = ({ hotels }: { hotels: Hotel[] }) => {
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [queries, setQueries] = useState<QueryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [selectedHotelCode, setSelectedHotelCode] = useState<string>('');
  const [parameters, setParameters] = useState<Record<string, string>>({});
  
  const [fetchingData, setFetchingData] = useState(false);
  const [reportData, setReportData] = useState<Record<string, any[]>>({}); // areaId -> data

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportsSnap, queriesSnap] = await Promise.all([
          getDocs(collection(db, 'report_definitions')),
          getDocs(collection(db, 'queries'))
        ]);
        setReports(reportsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ReportDefinition)));
        setQueries(queriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as QueryTemplate)));
        if (hotels.length > 0) {
          setSelectedHotelCode(hotels[0].hotel_code);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'multiple_collections');
        setError('Veriler yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [hotels]);

  const selectedReport = useMemo(() => reports.find(r => r.id === selectedReportId), [reports, selectedReportId]);

  // Extract all unique parameters needed for the selected report
  const requiredParameters = useMemo(() => {
    if (!selectedReport) return [];
    const paramsMap = new Map<string, { name: string, label: string, type: string }>();
    
    selectedReport.areas.forEach(area => {
      const query = queries.find(q => q.id === area.queryId);
      if (query && query.payload_template) {
        const regex = /\{\{(.*?)\}\}/g;
        const matches = [...query.payload_template.matchAll(regex)].map(m => m[1]);
        matches.forEach(v => {
          if (v !== 'HOTEL_ID' && v !== 'API_OBJECT') {
            if (!paramsMap.has(v)) {
              const paramDef = query.parameter_definitions?.find(p => p.name === v);
              const isDate = paramDef ? paramDef.type === 'date' : (v.toLowerCase().includes('tarih') || v.toLowerCase().includes('date') || v.toLowerCase().includes('baslangic') || v.toLowerCase().includes('bitis'));
              const isNumber = paramDef?.type === 'number';
              
              paramsMap.set(v, {
                name: v,
                label: paramDef?.label || v,
                type: isDate ? 'date' : isNumber ? 'number' : 'text'
              });
            }
          }
        });
      }
    });
    return Array.from(paramsMap.values());
  }, [selectedReport, queries]);

  const handleFetchData = async () => {
    if (!selectedReport || !selectedHotelCode) return;
    
    const hotel = hotels.find(h => h.hotel_code === selectedHotelCode);
    if (!hotel || !hotel.api_key) {
      setError("Seçili otelin API anahtarı bulunamadı.");
      return;
    }

    setFetchingData(true);
    setError(null);
    const newReportData: Record<string, any[]> = {};

    try {
      const promises = selectedReport.areas.map(async (area) => {
        const query = queries.find(q => q.id === area.queryId);
        if (!query) return;

        let payloadString = query.payload_template || "{}";
        payloadString = payloadString.replace(/\{\{HOTEL_ID\}\}/g, hotel.hotel_code);
        payloadString = payloadString.replace(/\{\{API_OBJECT\}\}/g, query.api_object || "");
        
        requiredParameters.forEach(param => {
          const val = parameters[param.name] || "";
          payloadString = payloadString.replace(new RegExp(`\\{\\{${param.name}\\}\\}`, 'g'), val);
        });

        // Validate JSON format before sending
        JSON.parse(payloadString);

        const response = await fetch(query.api_url || 'https://4001.hoteladvisor.net', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': hotel.api_key.trim()
          },
          body: payloadString
        });

        if (!response.ok) {
          throw new Error(`API Hatası (${response.status}): ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type");
        let responseData;
        if (contentType && contentType.indexOf("application/json") !== -1) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
          try { responseData = JSON.parse(responseData); } catch(e) {}
        }

        let data = [];
        if (Array.isArray(responseData)) {
          if (responseData.length > 0 && Array.isArray(responseData[0])) {
            data = responseData.flat();
          } else {
            data = responseData;
          }
        } else {
          data = responseData.data || responseData.items || [responseData];
        }

        if (query.response_index !== undefined && query.response_index !== null) {
           if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
             data = data[query.response_index || 0];
           }
        }

        if (!Array.isArray(data)) {
          data = [data];
        }

        newReportData[area.id] = data;
      });

      await Promise.all(promises);
      setReportData(newReportData);
    } catch (err: any) {
      console.error("Veri getirme hatası:", err);
      setError(err.message || 'Veri çekilirken bir hata oluştu.');
    } finally {
      setFetchingData(false);
    }
  };

  const formatForDisplay = (value: any, type?: string) => {
    if (value === null || value === undefined) return '-';
    
    if (type === 'date') {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return new Intl.DateTimeFormat('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }).format(date);
        }
      } catch (e) {}
      
      const str = String(value);
      const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        return `${match[3]}.${match[2]}.${match[1]}`;
      }
      return value;
    }
    
    if (type === 'number' || typeof value === 'number') {
      return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(value));
    }
    
    return String(value);
  };

  const aggregateData = (area: ReportArea, rawData: any[]) => {
    if (!rawData || !rawData.length || area.dimensions.length === 0 || area.metrics.length === 0) return [];

    const query = queries.find(q => q.id === area.queryId);

    const grouped = rawData.reduce((acc: any, row: any) => {
      const keyParts = area.dimensions.map(d => {
        const colDef = query?.column_definitions?.find(c => c.name === d.columnName);
        return formatForDisplay(row[d.columnName], colDef?.type);
      });
      const key = keyParts.join(' | ');
      
      if (!acc[key]) {
        acc[key] = { _displayKey: key, _count: 0 };
        area.dimensions.forEach(d => acc[key][d.columnName] = row[d.columnName]);
        area.metrics.forEach(m => {
          acc[key][m.columnName] = m.aggregation === 'MIN' ? Infinity : m.aggregation === 'MAX' ? -Infinity : 0;
        });
      }
      
      acc[key]._count += 1;
      area.metrics.forEach(m => {
        const val = Number(row[m.columnName]) || 0;
        switch (m.aggregation) {
          case 'SUM':
          case 'AVG':
            acc[key][m.columnName] += val;
            break;
          case 'MIN':
            acc[key][m.columnName] = Math.min(acc[key][m.columnName], val);
            break;
          case 'MAX':
            acc[key][m.columnName] = Math.max(acc[key][m.columnName], val);
            break;
          case 'COUNT':
            acc[key][m.columnName] = acc[key]._count;
            break;
        }
      });
      return acc;
    }, {});

    const result = Object.values(grouped);
    
    result.forEach((row: any) => {
      area.metrics.forEach(m => {
        if (m.aggregation === 'AVG' && row._count > 0) {
          row[m.columnName] = row[m.columnName] / row._count;
        }
      });
    });

    return result;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Rapor Görüntüleyici</h2>
          <p className="text-sm text-slate-500 mt-1">Oluşturduğunuz raporları görüntüleyin, analiz edin ve sunuma hazırlayın.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors shadow-sm font-medium text-sm"
          >
            <Printer size={18} />
            Yazdır / PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm border border-rose-100">
          {error}
        </div>
      )}

      {/* Rapor Seçimi ve Parametreler */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Rapor Seçin</label>
            <select
              value={selectedReportId}
              onChange={(e) => {
                setSelectedReportId(e.target.value);
                setReportData({});
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Rapor Seçiniz...</option>
              {reports.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {selectedReport && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Otel Seçin</label>
              <select
                value={selectedHotelCode}
                onChange={(e) => setSelectedHotelCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {hotels.map(h => (
                  <option key={h.id} value={h.hotel_code}>{h.name}</option>
                ))}
              </select>
            </div>
          )}

          {requiredParameters.map(param => (
            <div key={param.name}>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">{param.label}</label>
              <input
                type={param.type === 'date' ? 'date' : param.type === 'number' ? 'number' : 'text'}
                value={parameters[param.name] || ''}
                onChange={(e) => setParameters(prev => ({ ...prev, [param.name]: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          ))}

          {selectedReport && (
            <div>
              <button
                onClick={handleFetchData}
                disabled={fetchingData}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
              >
                {fetchingData ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                Raporu Oluştur
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rapor İçeriği */}
      {selectedReport && Object.keys(reportData).length > 0 && (
        <div className="space-y-8 print:space-y-12">
          <div className="text-center pb-6 border-b border-slate-200 print:border-slate-800">
            <h1 className="text-3xl font-bold text-slate-900">{selectedReport.name}</h1>
            {selectedReport.description && (
              <p className="text-slate-500 mt-2 max-w-2xl mx-auto">{selectedReport.description}</p>
            )}
            <p className="text-sm text-slate-400 mt-4">
              Otel: {hotels.find(h => h.hotel_code === selectedHotelCode)?.name} | 
              Oluşturulma Tarihi: {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}
            </p>
          </div>

          {selectedReport.areas.map((area, index) => {
            const rawData = reportData[area.id] || [];
            const aggregatedData = aggregateData(area, rawData);

            return (
              <div key={area.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0 break-inside-avoid">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-slate-800">{area.title || `Bölüm ${index + 1}`}</h3>
                  {area.subtitle && <p className="text-slate-500 mt-1">{area.subtitle}</p>}
                </div>

                {!aggregatedData.length ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Bu bölüm için veri bulunamadı.
                  </div>
                ) : (
                  <div className="w-full">
                    {area.chartType === 'TABLE' && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50 print:bg-slate-100">
                            <tr>
                              {area.dimensions.map((dim, i) => (
                                <th key={`th-dim-${i}`} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                  {dim.label}
                                </th>
                              ))}
                              {area.metrics.map((metric, i) => (
                                <th key={`th-met-${i}`} className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                  {metric.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-100">
                            {aggregatedData.map((row: any, i: number) => (
                              <tr key={i} className="hover:bg-slate-50">
                                {area.dimensions.map((dim, j) => {
                                  const query = queries.find(q => q.id === area.queryId);
                                  const colDef = query?.column_definitions?.find(c => c.name === dim.columnName);
                                  return (
                                    <td key={`td-dim-${i}-${j}`} className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-medium">
                                      {formatForDisplay(row[dim.columnName], colDef?.type)}
                                    </td>
                                  );
                                })}
                                {area.metrics.map((metric, j) => (
                                  <td key={`td-met-${i}-${j}`} className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right font-mono">
                                    {formatForDisplay(row[metric.columnName], 'number')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {area.chartType === 'BAR' && (
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={aggregatedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="_displayKey" angle={-45} textAnchor="end" height={80} tick={{fontSize: 12, fill: '#64748b'}} />
                            <YAxis tick={{fontSize: 12, fill: '#64748b'}} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: number) => new Intl.NumberFormat('tr-TR').format(value)}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            {area.metrics.map((m, i) => (
                              <Bar key={m.columnName} dataKey={m.columnName} name={m.label || m.columnName} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {area.chartType === 'LINE' && (
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsLineChart data={aggregatedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="_displayKey" angle={-45} textAnchor="end" height={80} tick={{fontSize: 12, fill: '#64748b'}} />
                            <YAxis tick={{fontSize: 12, fill: '#64748b'}} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: number) => new Intl.NumberFormat('tr-TR').format(value)}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            {area.metrics.map((m, i) => (
                              <Line key={m.columnName} type="monotone" dataKey={m.columnName} name={m.label || m.columnName} stroke={COLORS[i % COLORS.length]} strokeWidth={3} activeDot={{ r: 8 }} />
                            ))}
                          </RechartsLineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {area.chartType === 'PIE' && (
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: number) => new Intl.NumberFormat('tr-TR').format(value)}
                            />
                            <Legend />
                            {area.metrics.map((m, i) => (
                              <Pie
                                key={m.columnName}
                                data={aggregatedData}
                                dataKey={m.columnName}
                                nameKey="_displayKey"
                                cx="50%"
                                cy="50%"
                                outerRadius={120}
                                innerRadius={i > 0 ? 130 + (i * 20) : 0}
                                fill={COLORS[i % COLORS.length]}
                                label={i === 0 ? { fill: '#475569', fontSize: 12 } : undefined}
                              >
                                {aggregatedData.map((entry: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                            ))}
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!selectedReport && !loading && (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-200 text-slate-500">
          <FileText size={48} className="mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-700">Görüntülenecek Rapor Seçilmedi</p>
          <p className="text-sm mt-1 text-center max-w-md">Lütfen yukarıdaki menüden önceden oluşturduğunuz bir raporu seçin. Raporunuz yoksa "Rapor Oluşturucu" sayfasından yeni bir rapor oluşturabilirsiniz.</p>
        </div>
      )}
    </div>
  );
};
