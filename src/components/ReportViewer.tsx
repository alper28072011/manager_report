import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { QueryTemplate, Hotel, ReportDefinition, ReportArea, OperationType } from '../types';
import { handleFirestoreError } from '../utils/errorHandling';
import { resolveDynamicDate, DYNAMIC_DATE_OPTIONS } from '../utils/dateUtils';
import { Loader2, Play, Table as TableIcon, BarChart3, LineChart, PieChart, Printer, FileText, Save, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart as RechartsLineChart, Line, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { useSortableData } from '../hooks/useSortableData';
import { formatForDisplay, formatDateByGranularity, formatDateForDisplay } from '../utils/formatUtils';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const ReportAreaView = ({ area, rawData, queries, calculatedMeasures }: { area: ReportArea, rawData: any[], queries: QueryTemplate[], calculatedMeasures: any[] }) => {
  const query = queries.find(q => q.id === area.queryId);
  
  const extendedColumnDefinitions = useMemo(() => {
    const baseCols = query?.column_definitions || [];
    const measureCols = calculatedMeasures.map(m => ({
      name: m.measure_name,
      type: m.format_type || 'number',
      label: m.measure_name + ' (Hesaplanmış)'
    }));
    return [...baseCols, ...measureCols];
  }, [query, calculatedMeasures]);

  const aggregatedData = useMemo(() => {
    if (!rawData.length || area.dimensions.length === 0 || area.metrics.length === 0) return [];

    const grouped = rawData.reduce((acc: any, row: any) => {
      const keyParts = area.dimensions.map(d => {
        const colDef = extendedColumnDefinitions?.find(c => c.name === d.columnName);
        if (colDef?.type === 'date') {
          return formatDateByGranularity(row[d.columnName], d.dateGranularity);
        }
        return formatForDisplay(row[d.columnName], colDef?.type);
      });
      const key = keyParts.join(' | ');
      
      if (!acc[key]) {
        acc[key] = { _count: 0 };
        
        // Format display key for charts
        const displayKeyParts = area.dimensions.map((d, idx) => {
          const colDef = extendedColumnDefinitions?.find(c => c.name === d.columnName);
          if (colDef?.type === 'date') {
            return formatDateForDisplay(keyParts[idx], d.dateGranularity);
          }
          return keyParts[idx];
        });
        acc[key]._displayKey = displayKeyParts.join(' | ');

        area.dimensions.forEach((d, idx) => {
          const colDef = extendedColumnDefinitions?.find(c => c.name === d.columnName);
          acc[key][d.columnName] = colDef?.type === 'date' ? keyParts[idx] : row[d.columnName];
        });
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

      // Matrix aggregation
      if (area.chartType === 'MATRIX' && (area.columns || []).length > 0) {
        const colKeyParts = (area.columns || []).map(c => {
          const colDef = extendedColumnDefinitions?.find(ac => ac.name === c.columnName);
          if (colDef?.type === 'date') {
            return formatDateByGranularity(row[c.columnName], c.dateGranularity);
          }
          return formatForDisplay(row[c.columnName], colDef?.type);
        });
        const colKey = colKeyParts.join(' | ');

        if (!acc[key]._cols) acc[key]._cols = {};
        if (!acc[key]._cols[colKey]) {
          acc[key]._cols[colKey] = { _count: 0 };
          area.metrics.forEach(m => {
            acc[key]._cols[colKey][m.columnName] = m.aggregation === 'MIN' ? Infinity : m.aggregation === 'MAX' ? -Infinity : 0;
          });
        }
        
        acc[key]._cols[colKey]._count += 1;
        area.metrics.forEach(m => {
          const val = Number(row[m.columnName]) || 0;
          switch (m.aggregation) {
            case 'SUM':
            case 'AVG':
              acc[key]._cols[colKey][m.columnName] += val;
              break;
            case 'MIN':
              acc[key]._cols[colKey][m.columnName] = Math.min(acc[key]._cols[colKey][m.columnName], val);
              break;
            case 'MAX':
              acc[key]._cols[colKey][m.columnName] = Math.max(acc[key]._cols[colKey][m.columnName], val);
              break;
            case 'COUNT':
              acc[key]._cols[colKey][m.columnName] = acc[key]._cols[colKey]._count;
              break;
          }
        });
      }

      return acc;
    }, {});

    const result = Object.values(grouped);
    
    result.forEach((row: any) => {
      area.metrics.forEach(m => {
        if (m.aggregation === 'AVG' && row._count > 0) {
          row[m.columnName] = row[m.columnName] / row._count;
        }
      });
      if (row._cols) {
        Object.values(row._cols).forEach((col: any) => {
          area.metrics.forEach(m => {
            if (m.aggregation === 'AVG' && col._count > 0) {
              col[m.columnName] = col[m.columnName] / col._count;
            }
          });
        });
      }
    });

    // Default sort by first metric descending if topN is active
    if (area.topN && area.metrics.length > 0) {
      const primaryMetric = area.metrics[0].columnName;
      result.sort((a: any, b: any) => (Number(b[primaryMetric]) || 0) - (Number(a[primaryMetric]) || 0));
    } else {
      // Default sort by date dimension ascending
      const dateDim = area.dimensions.find(d => extendedColumnDefinitions?.find(c => c.name === d.columnName)?.type === 'date');
      if (dateDim) {
        result.sort((a: any, b: any) => {
          const aVal = String(a[dateDim.columnName] || '');
          const bVal = String(b[dateDim.columnName] || '');
          return aVal.localeCompare(bVal);
        });
      }
    }

    return result;
  }, [area, rawData, query]);

  const { items: sortedData, requestSort, sortConfig } = useSortableData(aggregatedData, {
    key: area.topN ? area.metrics[0]?.columnName : (area.dimensions.find(d => extendedColumnDefinitions?.find(c => c.name === d.columnName)?.type === 'date')?.columnName || area.dimensions[0]?.columnName),
    direction: area.topN ? 'desc' : 'asc'
  });

  const [showAllTopN, setShowAllTopN] = useState(false);

  const processedData = useMemo(() => {
    let data = [...sortedData];
    
    if (area.topN && area.topN > 0 && !showAllTopN && data.length > area.topN) {
      const topData = data.slice(0, area.topN);
      const othersData = data.slice(area.topN);
      
      const othersRow: any = { _displayKey: 'Diğer', _isOthers: true };
      
      area.dimensions.forEach(d => {
        othersRow[d.columnName] = 'Diğer';
      });
      
      area.metrics.forEach(m => {
        if (m.aggregation === 'SUM' || m.aggregation === 'COUNT') {
          othersRow[m.columnName] = othersData.reduce((sum, row) => sum + (Number(row[m.columnName]) || 0), 0);
        } else if (m.aggregation === 'AVG') {
          const total = othersData.reduce((sum, row) => sum + (Number(row[m.columnName]) || 0), 0);
          othersRow[m.columnName] = total / othersData.length;
        } else if (m.aggregation === 'MAX') {
          othersRow[m.columnName] = Math.max(...othersData.map(row => Number(row[m.columnName]) || -Infinity));
        } else if (m.aggregation === 'MIN') {
          othersRow[m.columnName] = Math.min(...othersData.map(row => Number(row[m.columnName]) || Infinity));
        }
      });
      
      return [...topData, othersRow];
    }
    
    return data;
  }, [sortedData, area.topN, area.metrics, area.dimensions, showAllTopN]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) {
      return <ArrowUp className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'ascending' ? (
      <ArrowUp className="w-3 h-3 text-indigo-600" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-600" />
    );
  };

  const matrixColumns = useMemo(() => {
    if (area.chartType !== 'MATRIX') return [];
    if (!(area.columns || []).length) {
      return [{ sortableKey: '_total', displayKey: 'Toplam' }];
    }
    
    // Extract unique column keys from the aggregated data
    const cols = new Set<string>();
    aggregatedData.forEach(row => {
      if (row._cols) {
        Object.keys(row._cols).forEach(colKey => cols.add(colKey));
      }
    });
    
    // Sort the keys alphabetically (works for formatted dates and strings)
    const sortedCols = Array.from(cols).sort();
    
    return sortedCols.map(colKey => {
      const parts = colKey.split(' | ');
      const displayKeyParts = (area.columns || []).map((c, idx) => {
        const colDef = extendedColumnDefinitions?.find(ac => ac.name === c.columnName);
        if (colDef?.type === 'date') {
          return formatDateForDisplay(parts[idx], c.dateGranularity);
        }
        return parts[idx];
      });
      return {
        sortableKey: colKey,
        displayKey: displayKeyParts.join(' | ')
      };
    });
  }, [aggregatedData, area.columns, area.chartType, query]);

  if (!aggregatedData.length) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        Bu bölüm için veri bulunamadı.
      </div>
    );
  }

  return (
    <div className="w-full">
      {area.chartType === 'TABLE' && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 print:bg-slate-100">
              <tr>
                {area.dimensions.map((dim, i) => (
                  <th 
                    key={`th-dim-${i}`} 
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                    onClick={() => requestSort(dim.columnName)}
                  >
                    <div className="flex items-center gap-1">
                      {dim.label}
                      <SortIcon columnKey={dim.columnName} />
                    </div>
                  </th>
                ))}
                {area.metrics.map((metric, i) => (
                  <th 
                    key={`th-met-${i}`} 
                    className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer group hover:bg-slate-100 transition-colors"
                    onClick={() => requestSort(metric.columnName)}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <SortIcon columnKey={metric.columnName} />
                      {metric.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {processedData.map((row: any, i: number) => (
                <tr key={i} className={`hover:bg-slate-50 ${row._isOthers ? 'bg-slate-50 font-semibold' : ''}`}>
                  {area.dimensions.map((dim, j) => {
                    const colDef = extendedColumnDefinitions?.find(c => c.name === dim.columnName);
                    return (
                      <td key={`td-dim-${i}-${j}`} className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-medium">
                        {row._isOthers ? row[dim.columnName] : formatForDisplay(row[dim.columnName], colDef?.type, dim.dateGranularity)}
                      </td>
                    );
                  })}
                  {area.metrics.map((metric, j) => {
                    const metricColDef = extendedColumnDefinitions.find(c => c.name === metric.columnName);
                    return (
                      <td key={`td-met-${i}-${j}`} className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right font-mono">
                        {formatForDisplay(row[metric.columnName], metricColDef?.type || 'number')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {area.chartType === 'BAR' && (
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
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
            <RechartsLineChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
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
                  data={processedData}
                  dataKey={m.columnName}
                  nameKey="_displayKey"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={i > 0 ? 130 + (i * 20) : 0}
                  fill={COLORS[i % COLORS.length]}
                  label={i === 0 ? { fill: '#475569', fontSize: 12 } : undefined}
                >
                  {processedData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              ))}
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
      )}

      {area.chartType === 'HORIZONTAL_BAR' && (
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData} layout="vertical" margin={{ top: 20, right: 30, left: 100, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{fontSize: 12, fill: '#64748b'}} />
              <YAxis dataKey="_displayKey" type="category" tick={{fontSize: 12, fill: '#64748b'}} width={90} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => new Intl.NumberFormat('tr-TR').format(value)}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              {area.metrics.map((m, i) => (
                <Bar key={m.columnName} dataKey={m.columnName} name={m.label || m.columnName} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {area.chartType === 'KPI' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {area.metrics.map((metric, idx) => {
            // KPI için toplam değeri hesapla
            const totalValue = processedData.reduce((sum, row) => {
              const val = Number(row[metric.columnName]) || 0;
              return sum + val;
            }, 0);
            
            // Eğer AVG ise ortalama al
            const finalValue = metric.aggregation === 'AVG' && processedData.length > 0 
              ? totalValue / processedData.length 
              : totalValue;

            const colDef = extendedColumnDefinitions.find(c => c.name === metric.columnName);
            const formatType = colDef?.type || 'number';

            return (
              <div key={`kpi-${idx}`} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                <p className="text-sm font-medium text-slate-500 mb-2">{metric.label}</p>
                <p className="text-3xl font-bold text-slate-800">
                  {formatForDisplay(finalValue, formatType)}
                </p>
              </div>
            );
          })}
          {area.metrics.length === 0 && (
            <div className="col-span-full p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              KPI kartı oluşturmak için en az bir metrik seçin.
            </div>
          )}
        </div>
      )}

      {area.chartType === 'MATRIX' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 print:bg-slate-100">
              <tr>
                {area.dimensions.map((dim, i) => (
                  <th key={`th-dim-${i}`} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider border-r border-slate-200">
                    {dim.label}
                  </th>
                ))}
                {/* Sütun Başlıkları (Dinamik) */}
                {matrixColumns.map((col, i) => (
                  <th key={`th-col-${i}`} className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200" colSpan={area.metrics.length}>
                    {col.displayKey}
                  </th>
                ))}
              </tr>
              <tr>
                {area.dimensions.map((_, i) => <th key={`th-empty-${i}`} className="border-r border-slate-200"></th>)}
                {matrixColumns.map((_, colIdx) => (
                  area.metrics.map((metric, j) => (
                    <th key={`th-met-${colIdx}-${j}`} className="px-4 py-2 text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider bg-slate-50/50">
                      {metric.label}
                    </th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {processedData.map((row: any, i: number) => (
                <tr key={i} className={`hover:bg-slate-50 ${row._isOthers ? 'bg-slate-50 font-semibold' : ''}`}>
                  {area.dimensions.map((dim, j) => {
                    const colDef = extendedColumnDefinitions?.find(c => c.name === dim.columnName);
                    return (
                      <td key={`td-dim-${i}-${j}`} className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-medium border-r border-slate-100">
                        {row._isOthers ? row[dim.columnName] : formatForDisplay(row[dim.columnName], colDef?.type, dim.dateGranularity)}
                      </td>
                    );
                  })}
                  {/* Her bir sütun kombinasyonu için metrikleri göster */}
                  {matrixColumns.map((col, colIdx) => (
                     area.metrics.map((metric, j) => {
                      const val = row._cols && row._cols[col.sortableKey] 
                        ? row._cols[col.sortableKey][metric.columnName] 
                        : (col.sortableKey === '_total' ? row[metric.columnName] : 0);
                      const metricColDef = extendedColumnDefinitions.find(c => c.name === metric.columnName);
                      return (
                        <td key={`td-met-${i}-${colIdx}-${j}`} className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right font-mono">
                          {formatForDisplay(val, metricColDef?.type || 'number')}
                        </td>
                      );
                    })
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {area.topN && area.topN > 0 && aggregatedData.length > area.topN && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowAllTopN(!showAllTopN)}
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            {showAllTopN ? 'Top N Görünümüne Dön' : 'Tümünü Gör'}
          </button>
        </div>
      )}
    </div>
  );
};

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
  const [hotelParameters, setHotelParameters] = useState<any[]>([]);
  const [calculatedMeasures, setCalculatedMeasures] = useState<any[]>([]);

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

  useEffect(() => {
    if (!selectedHotelCode) return;
    const fetchHotelSettings = async () => {
      try {
        const { query, where, collection, getDocs } = await import('firebase/firestore');
        
        const paramsQuery = query(collection(db, 'hotel_parameters'), where('hotel_id', '==', selectedHotelCode));
        const paramsSnap = await getDocs(paramsQuery);
        setHotelParameters(paramsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const measuresQuery = query(collection(db, 'calculated_measures'), where('hotel_id', '==', selectedHotelCode));
        const measuresSnap = await getDocs(measuresQuery);
        setCalculatedMeasures(measuresSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error fetching hotel settings:", error);
      }
    };
    fetchHotelSettings();
  }, [selectedHotelCode]);

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

  // Initialize parameters when a new report is selected
  useEffect(() => {
    const report = reports.find(r => r.id === selectedReportId);
    if (report) {
      const initialParams: Record<string, string> = {};
      report.areas.forEach(area => {
        if (area.parameters) {
          Object.entries(area.parameters).forEach(([key, value]) => {
            initialParams[key] = value as string;
          });
        }
      });
      setParameters(initialParams);
    } else {
      setParameters({});
    }
  }, [selectedReportId, reports]);

  const [savingParams, setSavingParams] = useState(false);

  const handleSaveParameters = async () => {
    if (!selectedReport) return;
    setSavingParams(true);
    setError(null);
    try {
      const updatedAreas = selectedReport.areas.map(area => {
        const query = queries.find(q => q.id === area.queryId);
        if (!query || !query.payload_template) return area;
        
        const regex = /\{\{(.*?)\}\}/g;
        const matches = [...query.payload_template.matchAll(regex)].map(m => m[1]);
        const areaParams: Record<string, string> = { ...(area.parameters || {}) };
        
        matches.forEach(v => {
          if (v !== 'HOTEL_ID' && v !== 'API_OBJECT' && parameters[v] !== undefined) {
            areaParams[v] = parameters[v];
          }
        });
        
        return { ...area, parameters: areaParams };
      });

      const reportRef = doc(db, 'report_definitions', selectedReport.id);
      await updateDoc(reportRef, {
        areas: updatedAreas,
        updatedAt: new Date()
      });
      
      setReports(prev => prev.map(r => r.id === selectedReport.id ? { ...r, areas: updatedAreas } : r));
      alert("Parametreler başarıyla kaydedildi.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'report_definitions');
      setError('Parametreler kaydedilirken bir hata oluştu.');
    } finally {
      setSavingParams(false);
    }
  };

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
          let val = parameters[param.name] || "";
          val = resolveDynamicDate(val);
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

        // Apply calculated measures
        if (calculatedMeasures.length > 0) {
          const paramsMap = hotelParameters.reduce((acc, p) => {
            acc[p.param_key] = Number(p.param_value) || p.param_value;
            return acc;
          }, {});

          data = data.map(row => {
            const newRow = { ...row };
            const context = { ...newRow, ...paramsMap };
            const keys = Object.keys(context);
            const values = Object.values(context);
            
            calculatedMeasures.forEach(measure => {
              try {
                // Create a safe function to evaluate the formula
                const func = new Function(...keys, `return ${measure.formula};`);
                newRow[measure.measure_name] = func(...values);
              } catch (e) {
                console.warn(`Error evaluating formula for ${measure.measure_name}:`, e);
                newRow[measure.measure_name] = 0;
              }
            });
            return newRow;
          });
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
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sol Taraf: Seçimler */}
          <div className="w-full md:w-1/3 space-y-5 md:border-r border-slate-100 md:pr-8">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Rapor Seçin</label>
              <select
                value={selectedReportId}
                onChange={(e) => {
                  setSelectedReportId(e.target.value);
                  setReportData({});
                }}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 hover:bg-white transition-colors"
              >
                <option value="">Rapor Seçiniz...</option>
                {reports.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            {selectedReport && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Otel Seçin</label>
                <select
                  value={selectedHotelCode}
                  onChange={(e) => setSelectedHotelCode(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 hover:bg-white transition-colors"
                >
                  {hotels.map(h => (
                    <option key={h.id} value={h.hotel_code}>{h.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Sağ Taraf: Parametreler ve Aksiyonlar */}
          <div className="w-full md:w-2/3 flex flex-col">
            {selectedReport ? (
              <>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4">Rapor Parametreleri</h3>
                  {requiredParameters.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {requiredParameters.map(param => {
                        const currentValue = parameters[param.name] || '';
                        const isDynamicDate = param.type === 'date' && currentValue.startsWith('{{');
                        
                        return (
                          <div key={param.name}>
                            <label className="block text-xs font-medium text-slate-600 mb-1.5">{param.label}</label>
                            {param.type === 'date' ? (
                              <div className="space-y-2">
                                <select
                                  value={isDynamicDate ? currentValue : (currentValue ? 'custom' : '')}
                                  onChange={(e) => {
                                    if (e.target.value === 'custom') {
                                      setParameters(prev => ({ ...prev, [param.name]: new Date().toISOString().split('T')[0] }));
                                    } else {
                                      setParameters(prev => ({ ...prev, [param.name]: e.target.value }));
                                    }
                                  }}
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                  <option value="">Seçiniz...</option>
                                  {DYNAMIC_DATE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                                {(!isDynamicDate && currentValue) && (
                                  <input
                                    type="date"
                                    value={currentValue}
                                    onChange={(e) => setParameters(prev => ({ ...prev, [param.name]: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                )}
                              </div>
                            ) : (
                              <input
                                type={param.type === 'number' ? 'number' : 'text'}
                                value={currentValue}
                                onChange={(e) => setParameters(prev => ({ ...prev, [param.name]: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-xl border border-slate-100">
                      Bu rapor için ayarlanabilir parametre bulunmuyor.
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center justify-end gap-3 mt-auto pt-6 border-t border-slate-100">
                  <button
                    onClick={handleSaveParameters}
                    disabled={savingParams}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    {savingParams ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Parametreleri Kaydet
                  </button>
                  <button
                    onClick={handleFetchData}
                    disabled={fetchingData}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm font-medium text-sm disabled:opacity-50"
                  >
                    {fetchingData ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                    Raporu Oluştur
                  </button>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-slate-100 border-dashed min-h-[150px]">
                Lütfen görüntülemek için sol taraftan bir rapor seçin.
              </div>
            )}
          </div>
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

            return (
              <div key={area.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0 break-inside-avoid">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-slate-800">{area.title || `Bölüm ${index + 1}`}</h3>
                  {area.subtitle && <p className="text-slate-500 mt-1">{area.subtitle}</p>}
                </div>
                <ReportAreaView area={area} rawData={rawData} queries={queries} calculatedMeasures={calculatedMeasures} />
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
