import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { QueryTemplate, Hotel, ReportDefinition, ReportDimension, ReportMetric, AggregationType, ChartType, ReportArea, OperationType, DateGranularity } from '../types';
import { Settings2, Play, Table as TableIcon, BarChart3, LineChart, PieChart, Save, Loader2, GripVertical, Trash2, X, ChevronDown, Plus, LayoutTemplate, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart as RechartsLineChart, Line, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { handleFirestoreError } from '../utils/errorHandling';
import { resolveDynamicDate, DYNAMIC_DATE_OPTIONS } from '../utils/dateUtils';
import { useSortableData } from '../hooks/useSortableData';
import { formatForDisplay, formatDateByGranularity, formatDateForDisplay } from '../utils/formatUtils';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export const ReportBuilder = () => {
  const [queries, setQueries] = useState<QueryTemplate[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [savedReports, setSavedReports] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Rapor Genel Ayarları
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  
  // Test Oteli
  const [testHotelCode, setTestHotelCode] = useState<string>('');
  const [hotelParameters, setHotelParameters] = useState<any[]>([]);
  const [calculatedMeasures, setCalculatedMeasures] = useState<any[]>([]);

  const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2);

  useEffect(() => {
    if (!testHotelCode) return;
    const fetchHotelSettings = async () => {
      try {
        const { query, where, collection, getDocs } = await import('firebase/firestore');
        
        const paramsQuery = query(collection(db, 'hotel_parameters'), where('hotel_id', '==', testHotelCode));
        const paramsSnap = await getDocs(paramsQuery);
        setHotelParameters(paramsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const measuresQuery = query(collection(db, 'calculated_measures'), where('hotel_id', '==', testHotelCode));
        const measuresSnap = await getDocs(measuresQuery);
        setCalculatedMeasures(measuresSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error fetching hotel settings:", error);
      }
    };
    fetchHotelSettings();
  }, [testHotelCode]);

  // Rapor Alanları (Görünümler)
  const [areas, setAreas] = useState<ReportArea[]>([{
    id: generateId(),
    title: 'Yeni Görünüm',
    subtitle: '',
    queryId: '',
    dimensions: [],
    columns: [],
    metrics: [],
    chartType: 'TABLE',
    parameters: {}
  }]);
  const [activeAreaId, setActiveAreaId] = useState<string>('');

  // Veri Önizleme
  const [previewDataMap, setPreviewDataMap] = useState<Record<string, any[]>>({});
  const [fetchingData, setFetchingData] = useState(false);
  
  // Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | 'update'>('new');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [queriesSnap, hotelsSnap, reportsSnap] = await Promise.all([
          getDocs(collection(db, 'queries')),
          getDocs(collection(db, 'hotels')),
          getDocs(collection(db, 'report_definitions'))
        ]);
        
        setQueries(queriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as QueryTemplate)));
        const fetchedHotels = hotelsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Hotel));
        setHotels(fetchedHotels);
        if (fetchedHotels.length > 0) {
          setTestHotelCode(fetchedHotels[0].hotel_code);
        }
        setSavedReports(reportsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ReportDefinition)));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'multiple_collections');
        setError('Veriler yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (areas.length > 0 && !areas.find(a => a.id === activeAreaId)) {
      setActiveAreaId(areas[0].id);
    }
  }, [areas, activeAreaId]);

  const activeArea = areas.find(a => a.id === activeAreaId) || areas[0];

  const updateActiveArea = (updates: Partial<ReportArea>) => {
    setAreas(prev => prev.map(a => a.id === activeAreaId ? { ...a, ...updates } : a));
  };

  const handleAddArea = () => {
    const newId = generateId();
    setAreas(prev => [...prev, {
      id: newId,
      title: `Görünüm ${prev.length + 1}`,
      subtitle: '',
      queryId: '',
      dimensions: [],
      columns: [],
      metrics: [],
      chartType: 'TABLE',
      parameters: {}
    }]);
    setActiveAreaId(newId);
  };

  const handleRemoveArea = (id: string) => {
    if (areas.length <= 1) return;
    setAreas(prev => prev.filter(a => a.id !== id));
    if (activeAreaId === id) {
      setActiveAreaId(areas[0].id);
    }
  };

  const selectedQuery = queries.find(q => q.id === activeArea.queryId);

  const dynamicVars = useMemo(() => {
    if (!selectedQuery?.payload_template) return [];
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [...selectedQuery.payload_template.matchAll(regex)];
    const allVars = Array.from(new Set(matches.map(m => m[1])));
    return allVars.filter(v => v !== 'HOTEL_ID' && v !== 'API_OBJECT');
  }, [selectedQuery]);

  const availableColumns = useMemo(() => {
    if (!selectedQuery?.column_definitions) return [];
    const baseColumns = selectedQuery.column_definitions.map(col => ({
      name: col.name,
      type: col.type,
      label: col.label || col.name
    }));
    
    // Add calculated measures as numeric columns
    const measureColumns = calculatedMeasures.map(m => ({
      name: m.measure_name,
      type: m.format_type || 'number',
      label: m.measure_name + ' (Hesaplanmış)'
    }));
    
    return [...baseColumns, ...measureColumns];
  }, [selectedQuery, calculatedMeasures]);

  const handleParamChange = (variable: string, value: string) => {
    updateActiveArea({
      parameters: {
        ...(activeArea.parameters || {}),
        [variable]: value
      }
    });
  };

  const executeQuery = async () => {
    if (!selectedQuery) return;
    
    if (!testHotelCode) {
      setError('Lütfen test için bir otel seçin.');
      return;
    }

    setFetchingData(true);
    setError(null);

    try {
      const hotel = hotels.find(h => h.hotel_code === testHotelCode);
      const apiKey = hotel?.api_key || '';
      const cleanApiKey = apiKey.trim();

      let payloadStr = selectedQuery.payload_template;
      
      // Sistem değişkenlerini değiştir
      payloadStr = payloadStr.replace(/\{\{HOTEL_ID\}\}/g, testHotelCode);
      payloadStr = payloadStr.replace(/\{\{API_OBJECT\}\}/g, selectedQuery.api_object || '');
      
      dynamicVars.forEach(variable => {
        let val = activeArea.parameters?.[variable] || '';
        val = resolveDynamicDate(val);
        payloadStr = payloadStr.replace(new RegExp(`\\{\\{${variable}\\}\\}`, 'g'), val);
      });

      // JSON formatını doğrula ama orijinal string'i gönder
      try {
        JSON.parse(payloadStr);
      } catch (e) {
        throw new Error('Payload JSON formatı geçersiz. Lütfen parametreleri kontrol edin.');
      }

      if (/[^\x20-\x7E]/.test(cleanApiKey)) {
        throw new Error('Seçili otelin API Anahtarında geçersiz karakterler var.');
      }

      const response = await fetch(selectedQuery.api_url || 'https://4001.hoteladvisor.net', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': cleanApiKey
        },
        body: payloadStr
      });

      if (!response.ok) {
        throw new Error(`API Hatası: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        data = await response.text();
        try {
          data = JSON.parse(data);
        } catch (e) {
          throw new Error('API yanıtı JSON formatında değil.');
        }
      }
      
      let resultData = data;
      if (selectedQuery.response_index !== undefined && selectedQuery.response_index !== null) {
        // If response_index is used, we might need to extract from an array
        // But let's just use the standard extraction logic
      }
      
      // Simple extraction logic if it's an array of arrays or similar
      if (Array.isArray(resultData) && resultData.length > 0 && Array.isArray(resultData[0])) {
         resultData = resultData[selectedQuery.response_index || 0];
      }

      if (!Array.isArray(resultData)) {
        resultData = [resultData];
      }

      // Apply calculated measures
      if (calculatedMeasures.length > 0) {
        const paramsMap = hotelParameters.reduce((acc, p) => {
          acc[p.param_key] = Number(p.param_value) || p.param_value;
          return acc;
        }, {});

        resultData = resultData.map(row => {
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

      setPreviewDataMap(prev => ({ ...prev, [activeAreaId]: resultData }));
    } catch (err: any) {
      console.error("Sorgu çalıştırma hatası:", err);
      setError(err.message || 'Veri çekilirken bir hata oluştu.');
    } finally {
      setFetchingData(false);
    }
  };

  const previewData = previewDataMap[activeAreaId] || [];

  const aggregatedData = useMemo(() => {
    if (!previewData.length || activeArea.dimensions.length === 0 || activeArea.metrics.length === 0) return [];

    const grouped = previewData.reduce((acc: any, row: any) => {
      const keyParts = activeArea.dimensions.map(d => {
        const colDef = availableColumns.find(c => c.name === d.columnName);
        if (colDef?.type === 'date') {
          return formatDateByGranularity(row[d.columnName], d.dateGranularity);
        }
        return formatForDisplay(row[d.columnName], colDef?.type);
      });
      const key = keyParts.join(' | ');
      
      if (!acc[key]) {
        acc[key] = { _count: 0 };
        
        // Format display key for charts
        const displayKeyParts = activeArea.dimensions.map((d, idx) => {
          const colDef = availableColumns.find(c => c.name === d.columnName);
          if (colDef?.type === 'date') {
            return formatDateForDisplay(keyParts[idx], d.dateGranularity);
          }
          return keyParts[idx];
        });
        acc[key]._displayKey = displayKeyParts.join(' | ');

        activeArea.dimensions.forEach((d, idx) => {
          const colDef = availableColumns.find(c => c.name === d.columnName);
          acc[key][d.columnName] = colDef?.type === 'date' ? keyParts[idx] : row[d.columnName];
        });
        activeArea.metrics.forEach(m => {
          acc[key][m.columnName] = m.aggregation === 'MIN' ? Infinity : m.aggregation === 'MAX' ? -Infinity : 0;
        });
      }
      
      acc[key]._count += 1;
      activeArea.metrics.forEach(m => {
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
      if (activeArea.chartType === 'MATRIX' && (activeArea.columns || []).length > 0) {
        const colKeyParts = (activeArea.columns || []).map(c => {
          const colDef = availableColumns.find(ac => ac.name === c.columnName);
          if (colDef?.type === 'date') {
            return formatDateByGranularity(row[c.columnName], c.dateGranularity);
          }
          return formatForDisplay(row[c.columnName], colDef?.type);
        });
        const colKey = colKeyParts.join(' | ');

        if (!acc[key]._cols) acc[key]._cols = {};
        if (!acc[key]._cols[colKey]) {
          acc[key]._cols[colKey] = { _count: 0 };
          activeArea.metrics.forEach(m => {
            acc[key]._cols[colKey][m.columnName] = m.aggregation === 'MIN' ? Infinity : m.aggregation === 'MAX' ? -Infinity : 0;
          });
        }
        
        acc[key]._cols[colKey]._count += 1;
        activeArea.metrics.forEach(m => {
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
      activeArea.metrics.forEach(m => {
        if (m.aggregation === 'AVG' && row._count > 0) {
          row[m.columnName] = row[m.columnName] / row._count;
        }
      });
      if (row._cols) {
        Object.values(row._cols).forEach((col: any) => {
          activeArea.metrics.forEach(m => {
            if (m.aggregation === 'AVG' && col._count > 0) {
              col[m.columnName] = col[m.columnName] / col._count;
            }
          });
        });
      }
    });

    // Default sort by first metric descending if topN is active
    if (activeArea.topN && activeArea.metrics.length > 0) {
      const primaryMetric = activeArea.metrics[0].columnName;
      result.sort((a: any, b: any) => (Number(b[primaryMetric]) || 0) - (Number(a[primaryMetric]) || 0));
    } else {
      // Default sort by date dimension ascending
      const dateDim = activeArea.dimensions.find(d => availableColumns.find(c => c.name === d.columnName)?.type === 'date');
      if (dateDim) {
        result.sort((a: any, b: any) => {
          const aVal = String(a[dateDim.columnName] || '');
          const bVal = String(b[dateDim.columnName] || '');
          return aVal.localeCompare(bVal);
        });
      }
    }

    return result;
  }, [previewData, activeArea.dimensions, activeArea.metrics, activeArea.topN]);

  const { items: sortedData, requestSort, sortConfig } = useSortableData(aggregatedData, {
    key: activeArea?.topN ? activeArea.metrics[0]?.columnName : (activeArea?.dimensions.find(d => availableColumns.find(c => c.name === d.columnName)?.type === 'date')?.columnName || activeArea?.dimensions[0]?.columnName || ''),
    direction: activeArea?.topN ? 'desc' : 'asc'
  });

  const [showAllTopN, setShowAllTopN] = useState(false);

  const processedData = useMemo(() => {
    let data = [...sortedData];
    
    if (activeArea.topN && activeArea.topN > 0 && !showAllTopN && data.length > activeArea.topN) {
      const topData = data.slice(0, activeArea.topN);
      const othersData = data.slice(activeArea.topN);
      
      const othersRow: any = { _displayKey: 'Diğer', _isOthers: true };
      
      activeArea.dimensions.forEach(d => {
        othersRow[d.columnName] = 'Diğer';
      });
      
      activeArea.metrics.forEach(m => {
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
  }, [sortedData, activeArea.topN, activeArea.metrics, activeArea.dimensions, showAllTopN]);

  const handleAddDimension = (columnName: string) => {
    if (!activeArea.dimensions.find(d => d.columnName === columnName)) {
      const col = availableColumns.find(c => c.name === columnName);
      updateActiveArea({ dimensions: [...activeArea.dimensions, { columnName, label: col?.label || columnName }] });
    }
  };

  const handleAddColumn = (columnName: string) => {
    if (!(activeArea.columns || []).find(d => d.columnName === columnName)) {
      const col = availableColumns.find(c => c.name === columnName);
      updateActiveArea({ columns: [...(activeArea.columns || []), { columnName, label: col?.label || columnName }] });
    }
  };

  const handleAddMetric = (columnName: string) => {
    if (!activeArea.metrics.find(m => m.columnName === columnName)) {
      const col = availableColumns.find(c => c.name === columnName);
      updateActiveArea({ metrics: [...activeArea.metrics, { columnName, label: col?.label || columnName, aggregation: 'SUM' }] });
    }
  };

  const handleRemoveDimension = (columnName: string) => {
    updateActiveArea({ dimensions: activeArea.dimensions.filter(d => d.columnName !== columnName) });
  };

  const matrixColumns = useMemo(() => {
    if (activeArea?.chartType !== 'MATRIX') return [];
    if (!(activeArea.columns || []).length) {
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
      const displayKeyParts = (activeArea.columns || []).map((c, idx) => {
        const colDef = availableColumns.find(ac => ac.name === c.columnName);
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
  }, [aggregatedData, activeArea?.columns, activeArea?.chartType, availableColumns]);

  const handleUpdateDimensionGranularity = (columnName: string, granularity: DateGranularity) => {
    updateActiveArea({
      dimensions: activeArea.dimensions.map(d => 
        d.columnName === columnName ? { ...d, dateGranularity: granularity } : d
      )
    });
  };

  const handleRemoveColumn = (columnName: string) => {
    updateActiveArea({ columns: (activeArea.columns || []).filter(d => d.columnName !== columnName) });
  };

  const handleUpdateColumnGranularity = (columnName: string, granularity: DateGranularity) => {
    updateActiveArea({
      columns: (activeArea.columns || []).map(c => 
        c.columnName === columnName ? { ...c, dateGranularity: granularity } : c
      )
    });
  };

  const handleRemoveMetric = (columnName: string) => {
    updateActiveArea({ metrics: activeArea.metrics.filter(m => m.columnName !== columnName) });
  };

  const handleMetricAggregationChange = (columnName: string, agg: AggregationType) => {
    updateActiveArea({ metrics: activeArea.metrics.map(m => m.columnName === columnName ? { ...m, aggregation: agg } : m) });
  };

  const handleLoadReport = (reportId: string) => {
    setSelectedReportId(reportId);
    if (!reportId) {
      setReportName('');
      setReportDescription('');
      const newId = generateId();
      setAreas([{
        id: newId,
        title: 'Yeni Görünüm',
        subtitle: '',
        queryId: '',
        dimensions: [],
        columns: [],
        metrics: [],
        chartType: 'TABLE',
        parameters: {}
      }]);
      setActiveAreaId(newId);
      setPreviewDataMap({});
      return;
    }
    const report = savedReports.find(r => r.id === reportId);
    if (report) {
      setReportName(report.name);
      setReportDescription(report.description || '');
      if (report.areas && report.areas.length > 0) {
        setAreas(report.areas);
        setActiveAreaId(report.areas[0].id);
      } else {
        const newId = generateId();
        setAreas([{
          id: newId,
          title: 'Görünüm 1',
          subtitle: '',
          queryId: (report as any).queryId || '',
          dimensions: (report as any).dimensions || [],
          columns: (report as any).columns || [],
          metrics: (report as any).metrics || [],
          chartType: (report as any).chartType || 'TABLE',
          parameters: (report as any).parameters || {}
        }]);
        setActiveAreaId(newId);
      }
      setPreviewDataMap({});
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm("Bu raporu silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, 'report_definitions', reportId));
      setSavedReports(prev => prev.filter(r => r.id !== reportId));
      if (selectedReportId === reportId) {
        handleLoadReport('');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'report_definitions');
      setError('Rapor silinirken bir hata oluştu.');
    }
  };

  const openSaveModal = () => {
    if (!reportName.trim()) {
      setError('Lütfen rapor adı girin.');
      return;
    }
    if (areas.length === 0) {
      setError('En az bir görünüm eklemelisiniz.');
      return;
    }
    
    for (const area of areas) {
      if (!area.queryId) {
        setError(`"${area.title}" görünümü için bir sorgu seçmelisiniz.`);
        return;
      }
      if (area.dimensions.length === 0 || area.metrics.length === 0) {
        setError(`"${area.title}" görünümü için en az bir satır (boyut) ve bir değer (metrik) seçmelisiniz.`);
        return;
      }
    }
    
    if (selectedReportId) {
      setSaveMode('update');
    } else {
      setSaveMode('new');
    }
    setShowSaveModal(true);
  };

  const confirmSaveReport = async () => {
    try {
      const reportDef: Omit<ReportDefinition, 'id'> = {
        name: reportName,
        description: reportDescription,
        areas: areas,
        updatedAt: serverTimestamp()
      };

      if (saveMode === 'update' && selectedReportId) {
        await updateDoc(doc(db, 'report_definitions', selectedReportId), reportDef);
        setSavedReports(prev => prev.map(r => r.id === selectedReportId ? { ...r, ...reportDef, id: selectedReportId } as ReportDefinition : r));
      } else {
        reportDef.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, 'report_definitions'), reportDef);
        setSelectedReportId(docRef.id);
        setSavedReports(prev => [...prev, { ...reportDef, id: docRef.id } as ReportDefinition]);
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setShowSaveModal(false);
    } catch (err) {
      handleFirestoreError(err, saveMode === 'update' ? OperationType.UPDATE : OperationType.CREATE, 'report_definitions');
      setError('Rapor kaydedilirken bir hata oluştu.');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Rapor Oluşturucu</h2>
          <p className="text-sm text-slate-500 mt-1">Birden fazla görünüm (tablo, grafik vb.) içeren raporlar tasarlayın.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative min-w-[200px]">
            <select 
              value={selectedReportId} 
              onChange={e => handleLoadReport(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 bg-white appearance-none shadow-sm"
            >
              <option value="">-- Kayıtlı Rapor Seç --</option>
              {savedReports.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {selectedReportId && (
            <button 
              onClick={() => handleDeleteReport(selectedReportId)}
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              title="Seçili Raporu Sil"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={openSaveModal}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
          >
            <Save size={18} />
            Raporu Kaydet
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm border border-rose-100 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0"></div>
          {error}
        </div>
      )}

      {saveSuccess && (
        <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl text-sm border border-emerald-100 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></div>
          Rapor başarıyla kaydedildi!
        </div>
      )}

      {/* Görünümler Sekmesi */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {areas.map(area => (
          <button
            key={area.id}
            onClick={() => setActiveAreaId(area.id)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${activeAreaId === area.id ? 'bg-white text-indigo-600 border-t border-l border-r border-slate-200 shadow-[0_2px_0_0_white]' : 'text-slate-500 hover:bg-slate-50 border border-transparent'}`}
            style={activeAreaId === area.id ? { marginBottom: '-1px' } : {}}
          >
            {area.title || 'İsimsiz Görünüm'}
          </button>
        ))}
        <button
          onClick={handleAddArea}
          className="px-3 py-2 text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 text-sm font-medium"
        >
          <Plus size={16} /> Yeni Görünüm
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sol Panel: Ayarlar ve Sütunlar */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Genel Rapor Ayarları */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Settings2 size={16} className="text-indigo-500" />
              Genel Rapor Ayarları
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Rapor Adı</label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="Örn: Aylık Gelen Oda Raporu"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Açıklama (İsteğe Bağlı)</label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Rapor hakkında kısa bir bilgi..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Test Oteli</label>
                <select
                  value={testHotelCode}
                  onChange={(e) => setTestHotelCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Seçiniz...</option>
                  {hotels.map(h => (
                    <option key={h.id} value={h.hotel_code}>{h.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Görünüm Ayarları */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <LayoutTemplate size={16} className="text-indigo-500" />
                Görünüm Ayarları
              </h3>
              {areas.length > 1 && (
                <button onClick={() => handleRemoveArea(activeAreaId)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Görünümü Sil">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Görünüm Başlığı</label>
                <input
                  type="text"
                  value={activeArea.title}
                  onChange={(e) => updateActiveArea({ title: e.target.value })}
                  placeholder="Örn: Gelir Özeti"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Alt Başlık (İsteğe Bağlı)</label>
                <input
                  type="text"
                  value={activeArea.subtitle || ''}
                  onChange={(e) => updateActiveArea({ subtitle: e.target.value })}
                  placeholder="Örn: Son 30 günlük veriler"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Veri Kaynağı (Sorgu)</label>
                <select
                  value={activeArea.queryId}
                  onChange={(e) => updateActiveArea({ queryId: e.target.value, dimensions: [], columns: [], metrics: [], parameters: {} })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Sorgu Seçin...</option>
                  {queries.map(q => (
                    <option key={q.id} value={q.id}>{q.query_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Parametreler ve Önizleme Verisi Çekme */}
          {selectedQuery && dynamicVars.length > 0 && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center justify-between">
                <span>Test Parametreleri</span>
                <button 
                  onClick={executeQuery}
                  disabled={fetchingData}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-medium transition-colors"
                >
                  {fetchingData ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Veri Getir
                </button>
              </h3>
              <div className="space-y-3">
                {dynamicVars.map(variable => {
                  const paramDef = selectedQuery.parameter_definitions?.find(p => p.name === variable);
                  const isDate = paramDef ? paramDef.type === 'date' : (variable.toLowerCase().includes('tarih') || variable.toLowerCase().includes('date') || variable.toLowerCase().includes('baslangic') || variable.toLowerCase().includes('bitis'));
                  const isNumber = paramDef?.type === 'number';
                  const label = paramDef?.label || variable;
                  const currentValue = activeArea.parameters?.[variable] || '';
                  const isDynamicDate = isDate && currentValue.startsWith('{{');
                  
                  return (
                    <div key={variable}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                      {isDate ? (
                        <div className="space-y-2">
                          <select
                            value={isDynamicDate ? currentValue : (currentValue ? 'custom' : '')}
                            onChange={(e) => {
                              if (e.target.value === 'custom') {
                                handleParamChange(variable, new Date().toISOString().split('T')[0]);
                              } else {
                                handleParamChange(variable, e.target.value);
                              }
                            }}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                              onChange={(e) => handleParamChange(variable, e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          )}
                        </div>
                      ) : (
                        <input
                          type={isNumber ? "number" : "text"}
                          value={currentValue}
                          onChange={(e) => handleParamChange(variable, e.target.value)}
                          placeholder={`${label}...`}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Kullanılabilir Sütunlar */}
          {availableColumns.length > 0 && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Kullanılabilir Sütunlar</h3>
              <div className="max-h-64 overflow-y-auto pr-2 space-y-2">
                {availableColumns.map(col => {
                  const isDimensionAdded = activeArea.dimensions.some(d => d.columnName === col.name);
                  const isColumnAdded = (activeArea.columns || []).some(d => d.columnName === col.name);
                  const isMetricAdded = activeArea.metrics.some(m => m.columnName === col.name);
                  const isNumeric = col.type === 'number' || col.type === 'percentage' || col.type === 'currency';

                  return (
                    <div key={col.name} className="flex items-center justify-between p-2 hover:bg-slate-50 border border-slate-100 rounded-lg group transition-colors">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <GripVertical size={14} className="text-slate-300" />
                        <span className="text-sm font-medium text-slate-700 truncate" title={col.label}>{col.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase">{col.type}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleAddDimension(col.name)}
                          disabled={isDimensionAdded}
                          className={`text-[10px] px-2 py-1 rounded font-medium ${isDimensionAdded ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                          title="Satır olarak ekle"
                        >
                          Satır
                        </button>
                        <button 
                          onClick={() => handleAddColumn(col.name)}
                          disabled={isColumnAdded}
                          className={`text-[10px] px-2 py-1 rounded font-medium ${isColumnAdded ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                          title="Sütun olarak ekle"
                        >
                          Sütun
                        </button>
                        {isNumeric && (
                          <button 
                            onClick={() => handleAddMetric(col.name)}
                            disabled={isMetricAdded}
                            className={`text-[10px] px-2 py-1 rounded font-medium ${isMetricAdded ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                            title="Değer/Metrik olarak ekle"
                          >
                            Değer
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sağ Panel: Rapor Tasarımı ve Önizleme */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Tasarım Alanı (Drop Zones) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Dimensions (Satırlar) */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  Satırlar
                </h4>
                <div className="min-h-[100px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-3 space-y-2">
                  {activeArea.dimensions.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center">
                      Sütunlardan satır ekleyin
                    </div>
                  ) : (
                    activeArea.dimensions.map((dim, idx) => {
                      const isDate = availableColumns.find(c => c.name === dim.columnName)?.type === 'date';
                      return (
                        <div key={idx} className="flex flex-col bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700">{dim.label}</span>
                            <button onClick={() => handleRemoveDimension(dim.columnName)} className="text-slate-400 hover:text-rose-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {isDate && (
                            <select
                              value={dim.dateGranularity || 'day'}
                              onChange={(e) => handleUpdateDimensionGranularity(dim.columnName, e.target.value as DateGranularity)}
                              className="text-xs border-slate-200 rounded-md py-1"
                            >
                              <option value="day">Gün</option>
                              <option value="dayOfWeek">Haftanın Günü</option>
                              <option value="week">Hafta</option>
                              <option value="month">Ay</option>
                              <option value="quarter">Çeyrek</option>
                              <option value="year">Yıl</option>
                            </select>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Columns (Sütunlar) */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  Sütunlar
                </h4>
                <div className="min-h-[100px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-3 space-y-2">
                  {!(activeArea.columns || []).length ? (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center">
                      Sütunlardan sütun ekleyin
                    </div>
                  ) : (
                    (activeArea.columns || []).map((col, idx) => {
                      const isDate = availableColumns.find(c => c.name === col.columnName)?.type === 'date';
                      return (
                        <div key={idx} className="flex flex-col bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700">{col.label}</span>
                            <button onClick={() => handleRemoveColumn(col.columnName)} className="text-slate-400 hover:text-rose-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {isDate && (
                            <select
                              value={col.dateGranularity || 'day'}
                              onChange={(e) => handleUpdateColumnGranularity(col.columnName, e.target.value as DateGranularity)}
                              className="text-xs border-slate-200 rounded-md py-1"
                            >
                              <option value="day">Gün</option>
                              <option value="dayOfWeek">Haftanın Günü</option>
                              <option value="week">Hafta</option>
                              <option value="month">Ay</option>
                              <option value="quarter">Çeyrek</option>
                              <option value="year">Yıl</option>
                            </select>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Metrics (Değerler) */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  Değerler
                </h4>
                <div className="min-h-[100px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-3 space-y-2">
                  {activeArea.metrics.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400">
                      Sütunlardan değer ekleyin
                    </div>
                  ) : (
                    activeArea.metrics.map((metric, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-slate-700 truncate block">{metric.label}</span>
                        </div>
                        <select
                          value={metric.aggregation}
                          onChange={(e) => handleMetricAggregationChange(metric.columnName, e.target.value as AggregationType)}
                          className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-slate-50 text-slate-600 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="SUM">Topla</option>
                          <option value="AVG">Ortalama</option>
                          <option value="MIN">En Düşük</option>
                          <option value="MAX">En Yüksek</option>
                          <option value="COUNT">Say</option>
                        </select>
                        <button onClick={() => handleRemoveMetric(metric.columnName)} className="text-slate-400 hover:text-rose-500 transition-colors ml-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Grafik Türü Seçimi */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Görünüm Türü</h4>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => updateActiveArea({ chartType: 'TABLE' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeArea.chartType === 'TABLE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  <TableIcon size={16} /> Tablo
                </button>
                <button
                  onClick={() => updateActiveArea({ chartType: 'MATRIX' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeArea.chartType === 'MATRIX' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  <LayoutTemplate size={16} /> Matris Tablo
                </button>
                <button
                  onClick={() => updateActiveArea({ chartType: 'BAR' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeArea.chartType === 'BAR' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  <BarChart3 size={16} /> Çubuk Grafik
                </button>
                <button
                  onClick={() => updateActiveArea({ chartType: 'HORIZONTAL_BAR' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeArea.chartType === 'HORIZONTAL_BAR' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  <BarChart3 size={16} className="rotate-90" /> Yatay Çubuk Grafik
                </button>
                <button
                  onClick={() => updateActiveArea({ chartType: 'LINE' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeArea.chartType === 'LINE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  <LineChart size={16} /> Çizgi Grafik
                </button>
                <button
                  onClick={() => updateActiveArea({ chartType: 'PIE' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeArea.chartType === 'PIE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  <PieChart size={16} /> Pasta Grafik
                </button>
                <button
                  onClick={() => updateActiveArea({ chartType: 'KPI' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeArea.chartType === 'KPI' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  <BarChart3 size={16} /> KPI Kartı
                </button>
              </div>
            </div>

            {/* Top N Seçimi */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Gelişmiş Ayarlar</h4>
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">İlk N Kayıt (Top N)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Örn: 5, 10"
                      value={activeArea.topN || ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                        updateActiveArea({ topN: val });
                      }}
                      className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <span className="text-xs text-slate-500">Kalan veriler "Diğer" olarak gruplanır.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Önizleme Alanı */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Görünüm Önizleme</h3>
            
            {!previewData.length ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <TableIcon size={32} className="mb-2 opacity-50" />
                <p className="text-sm">Önizleme için sol panelden "Veri Getir" butonuna tıklayın.</p>
              </div>
            ) : activeArea.dimensions.length === 0 || activeArea.metrics.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Settings2 size={32} className="mb-2 opacity-50" />
                <p className="text-sm">Görünümü görmek için en az bir satır ve bir değer ekleyin.</p>
              </div>
            ) : (
              <div className="min-h-[300px] w-full overflow-x-auto">
                {activeArea.chartType === 'TABLE' && (
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        {activeArea.dimensions.map((dim, i) => (
                          <th 
                            key={`th-dim-${i}`} 
                            className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => requestSort(dim.columnName)}
                          >
                            <div className="flex items-center gap-1">
                              {dim.label}
                              {sortConfig?.key === dim.columnName && (
                                sortConfig.direction === 'ascending' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                              )}
                            </div>
                          </th>
                        ))}
                        {activeArea.metrics.map((metric, i) => (
                          <th 
                            key={`th-met-${i}`} 
                            className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => requestSort(metric.columnName)}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {metric.label} ({metric.aggregation})
                              {sortConfig?.key === metric.columnName && (
                                sortConfig.direction === 'ascending' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {processedData.map((row, i) => (
                        <tr key={i} className={`hover:bg-slate-50 ${row._isOthers ? 'bg-slate-50 font-semibold' : ''}`}>
                          {activeArea.dimensions.map((dim, j) => {
                            const colDef = availableColumns.find(c => c.name === dim.columnName);
                            return (
                              <td key={`td-dim-${i}-${j}`} className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-medium">
                                {row._isOthers ? row[dim.columnName] : formatForDisplay(row[dim.columnName], colDef?.type, dim.dateGranularity)}
                              </td>
                            );
                          })}
                          {activeArea.metrics.map((metric, j) => {
                            const metricColDef = availableColumns.find(c => c.name === metric.columnName);
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
                )}

                {activeArea.chartType === 'BAR' && (
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
                        {activeArea.metrics.map((m, i) => (
                          <Bar key={m.columnName} dataKey={m.columnName} name={`${m.label} (${m.aggregation})`} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {activeArea.chartType === 'LINE' && (
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
                        {activeArea.metrics.map((m, i) => (
                          <Line key={m.columnName} type="monotone" dataKey={m.columnName} name={`${m.label} (${m.aggregation})`} stroke={COLORS[i % COLORS.length]} strokeWidth={3} activeDot={{ r: 8 }} />
                        ))}
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {activeArea.chartType === 'PIE' && (
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number) => new Intl.NumberFormat('tr-TR').format(value)}
                        />
                        <Legend />
                        <Pie
                          data={processedData}
                          dataKey={activeArea.metrics[0]?.columnName || ''}
                          nameKey="_displayKey"
                          cx="50%"
                          cy="50%"
                          outerRadius={130}
                          fill="#8884d8"
                          label={(entry) => entry._displayKey}
                        >
                          {processedData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {activeArea.chartType === 'HORIZONTAL_BAR' && (
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
                        {activeArea.metrics.map((m, i) => (
                          <Bar key={m.columnName} dataKey={m.columnName} name={`${m.label} (${m.aggregation})`} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {activeArea.chartType === 'KPI' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeArea.metrics.map((metric, idx) => {
                      // KPI için toplam değeri hesapla
                      const totalValue = processedData.reduce((sum, row) => {
                        const val = Number(row[metric.columnName]) || 0;
                        return sum + val;
                      }, 0);
                      
                      // Eğer AVG ise ortalama al
                      const finalValue = metric.aggregation === 'AVG' && processedData.length > 0 
                        ? totalValue / processedData.length 
                        : totalValue;

                      const colDef = availableColumns.find(c => c.name === metric.columnName);
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
                    {activeArea.metrics.length === 0 && (
                      <div className="col-span-full p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        KPI kartı oluşturmak için en az bir metrik seçin.
                      </div>
                    )}
                  </div>
                )}
                {activeArea.chartType === 'MATRIX' && (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          {activeArea.dimensions.map((dim, i) => (
                            <th key={`th-dim-${i}`} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-200">
                              {dim.label}
                            </th>
                          ))}
                          {/* Sütun Başlıkları (Dinamik) */}
                          {matrixColumns.map((col, i) => (
                            <th key={`th-col-${i}`} className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200" colSpan={activeArea.metrics.length}>
                              {col.displayKey}
                            </th>
                          ))}
                        </tr>
                        <tr>
                          {activeArea.dimensions.map((_, i) => <th key={`th-empty-${i}`} className="border-r border-slate-200"></th>)}
                          {matrixColumns.map((_, colIdx) => (
                            activeArea.metrics.map((metric, j) => (
                              <th key={`th-met-${colIdx}-${j}`} className="px-4 py-2 text-right text-[10px] font-medium text-slate-400 uppercase tracking-wider bg-slate-50/50">
                                {metric.label}
                              </th>
                            ))
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {processedData.map((row, i) => (
                          <tr key={i} className={`hover:bg-slate-50 ${row._isOthers ? 'bg-slate-50 font-semibold' : ''}`}>
                            {activeArea.dimensions.map((dim, j) => {
                              const colDef = availableColumns.find(c => c.name === dim.columnName);
                              return (
                                <td key={`td-dim-${i}-${j}`} className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-medium border-r border-slate-100">
                                  {row._isOthers ? row[dim.columnName] : formatForDisplay(row[dim.columnName], colDef?.type, dim.dateGranularity)}
                                </td>
                              );
                            })}
                            {/* Her bir sütun kombinasyonu için metrikleri göster */}
                            {matrixColumns.map((col, colIdx) => (
                               activeArea.metrics.map((metric, j) => {
                                const val = row._cols && row._cols[col.sortableKey] 
                                  ? row._cols[col.sortableKey][metric.columnName] 
                                  : (col.sortableKey === '_total' ? row[metric.columnName] : 0);
                                const metricColDef = availableColumns.find(c => c.name === metric.columnName);
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

                {activeArea.topN && activeArea.topN > 0 && aggregatedData.length > activeArea.topN && (
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
            )}
          </div>

        </div>
      </div>

      {/* Rapor Kaydetme Modalı */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {saveMode === 'update' ? 'Raporu Güncelle' : 'Yeni Rapor Kaydet'}
              </h3>
              <button onClick={() => setShowSaveModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 space-y-5">
              {selectedReportId && (
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
                      setReportName(reportName + " (Kopya)");
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${saveMode === 'new' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Farklı Kaydet
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Rapor Adı</label>
                <input 
                  type="text" 
                  value={reportName}
                  onChange={e => setReportName(e.target.value)}
                  placeholder="Örn: Aylık Gelen Oda Raporu"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                />
              </div>
              
              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                <p className="text-xs text-indigo-700 leading-relaxed">
                  {saveMode === 'update' 
                    ? "Mevcut raporun tüm görünümleri ve ayarları güncellenecektir." 
                    : "Şu anki ayarlarınız yeni bir rapor olarak kaydedilecektir."}
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
                onClick={confirmSaveReport}
                disabled={!reportName.trim()}
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
