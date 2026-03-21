import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { QueryTemplate, Hotel, DailySummary, NationalityData, OperationType } from '../types';
import { handleFirestoreError } from '../utils/errorHandling';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Hotel as HotelIcon, Users, Percent, Calendar, Loader2, Building2 } from 'lucide-react';

const COLORS = ['#0ea5e9', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b'];

const formatCurrency = (value: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
const formatNumber = (value: number) => new Intl.NumberFormat('tr-TR').format(value);

const KPICard = ({ title, icon: Icon, actual, target, prefix = '', suffix = '', isCurrency = false }: any) => {
  const achievementPct = target > 0 ? (actual / target) * 100 : 0;
  const isPositive = achievementPct >= 100;
  const displayActual = isCurrency ? formatCurrency(actual) : formatNumber(actual) + suffix;
  const displayTarget = isCurrency ? formatCurrency(target) : formatNumber(target) + suffix;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Icon size={20} strokeWidth={2.5} /></div>
          <h3 className="text-slate-500 font-medium text-sm">{title}</h3>
        </div>
        <div className={`flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span>{achievementPct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="mt-2">
        <div className="text-3xl font-bold text-slate-900 tracking-tight">{prefix}{displayActual}</div>
        <div className="text-sm text-slate-400 mt-2 font-medium">Hedef: <span className="text-slate-600">{prefix}{displayTarget}</span></div>
      </div>
    </div>
  );
};

export const ReportDashboard = ({ hotels }: { hotels: Hotel[] }) => {
  const [selectedHotel, setSelectedHotel] = useState<string>(hotels[0]?.hotel_code || '');
  const [queries, setQueries] = useState<QueryTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [dateRange, setDateRange] = useState({ start: '2026-01-01', end: '2026-12-31' });

  // Mock Data for now (since we don't have real API responses)
  const [dailyData, setDailyData] = useState<DailySummary[]>([]);
  const [nationalityData, setNationalityData] = useState<NationalityData[]>([]);

  if (error) throw error;

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

  const fetchData = async () => {
    if (!selectedHotel) return;
    const hotel = hotels.find(h => h.hotel_code === selectedHotel);
    if (!hotel || !hotel.api_key) {
      alert("Seçili otelin API anahtarı bulunamadı.");
      return;
    }

    setLoading(true);
    try {
      // Execute all active queries
      const queryPromises = queries.map(async (q) => {
        const simulatedPayload = q.payload_template
          .replace(/{{HOTEL_ID}}/g, hotel.hotel_code)
          .replace(/{{REPORT_START_DATE}}/g, dateRange.start)
          .replace(/{{REPORT_END_DATE}}/g, dateRange.end)
          .replace(/{{API_OBJECT}}/g, q.api_object || "");

        const response = await fetch(q.api_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': hotel.api_key.trim()
          },
          body: simulatedPayload
        });

        if (!response.ok) {
          throw new Error(`API Hatası: ${q.query_name} - ${response.statusText}`);
        }

        const contentType = response.headers.get("content-type");
        let responseData;
        if (contentType && contentType.indexOf("application/json") !== -1) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }
        
        return { queryName: q.query_name, data: responseData };
      });

      const results = await Promise.all(queryPromises);
      console.log("API Results:", results);

      // For demonstration, we'll still set some mock data after a delay
      // In a real app, you would parse the `results` array to populate these states
      
      setDailyData([
        { date: 'Oca', target_revenue: 150000, actual_revenue: 165000, target_pax: 1200, actual_pax: 1350, target_occupancy: 65, actual_occupancy: 72 },
        { date: 'Şub', target_revenue: 160000, actual_revenue: 155000, target_pax: 1300, actual_pax: 1250, target_occupancy: 70, actual_occupancy: 68 },
        { date: 'Mar', target_revenue: 180000, actual_revenue: 195000, target_pax: 1500, actual_pax: 1650, target_occupancy: 75, actual_occupancy: 82 },
        { date: 'Nis', target_revenue: 220000, actual_revenue: 240000, target_pax: 1800, actual_pax: 2100, target_occupancy: 80, actual_occupancy: 88 },
      ]);
      
      setNationalityData([
        { name: 'Almanya', value: 45 },
        { name: 'İngiltere', value: 25 },
        { name: 'Rusya', value: 15 },
        { name: 'Yerli', value: 10 },
        { name: 'Diğer', value: 5 },
      ]);
      
    } catch (err: any) {
      console.error(err);
      alert(`Veri çekilirken hata oluştu: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedHotel && queries.length > 0) {
      fetchData();
    }
  }, [selectedHotel, dateRange]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Building2 size={20} className="text-slate-400" />
            <select value={selectedHotel} onChange={e => setSelectedHotel(e.target.value)} className="border-none bg-slate-50 rounded-lg py-2 px-4 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500">
              {hotels.map(h => <option key={h.id} value={h.hotel_code}>{h.name} ({h.hotel_code})</option>)}
            </select>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-slate-400" />
            <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="border-none bg-slate-50 rounded-lg py-2 px-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500" />
            <span className="text-slate-400">-</span>
            <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="border-none bg-slate-50 rounded-lg py-2 px-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>
        <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200 disabled:opacity-70">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <TrendingUp size={18} />}
          Raporu Yenile
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 size={48} className="animate-spin text-indigo-600" />
        </div>
      ) : dailyData.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KPICard title="Toplam Gelir" icon={HotelIcon} actual={755000} target={710000} isCurrency={true} />
            <KPICard title="Toplam Geceleme (Pax)" icon={Users} actual={6350} target={5800} />
            <KPICard title="Ortalama Doluluk" icon={Percent} actual={77.5} target={72.5} suffix="%" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Aylık Gelir Karşılaştırması</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `€${value / 1000}k`} />
                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => formatCurrency(value)} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="actual_revenue" name="Gerçekleşen Gelir" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="target_revenue" name="Hedef Gelir" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Uyruk Dağılımı</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={nationalityData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                      {nationalityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => [`%${value}`, 'Oran']} />
                    <Legend iconType="circle" layout="vertical" verticalAlign="bottom" align="center" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-slate-500">Raporları görüntülemek için bir otel seçin ve "Raporu Yenile" butonuna tıklayın.</p>
        </div>
      )}
    </div>
  );
};
