import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Hotel, Users, Percent, Calendar, Loader2, Building2,
  Database, Plus, Save, Settings, LayoutDashboard, CheckCircle2, XCircle
} from 'lucide-react';

// --- TİPLER (TYPES) ---
interface DailySummary {
  date: string;
  target_revenue: number;
  actual_revenue: number;
  target_pax: number;
  actual_pax: number;
  target_occupancy: number;
  actual_occupancy: number;
}

interface NationalityData {
  name: string;
  value: number;
}

interface QueryTemplate {
  id: number;
  query_name: string;
  api_object: string;
  columns_grouped: string;
  columns_summed: string;
  is_active: boolean;
}

// --- MOCK VERİ (BACKEND SİMÜLASYONU) ---
const MOCK_TREND_DATA: DailySummary[] = [
  { date: '2026-03-01', target_revenue: 12000, actual_revenue: 11500, target_pax: 150, actual_pax: 142, target_occupancy: 75, actual_occupancy: 72 },
  { date: '2026-03-02', target_revenue: 12500, actual_revenue: 13200, target_pax: 160, actual_pax: 165, target_occupancy: 78, actual_occupancy: 81 },
  { date: '2026-03-03', target_revenue: 13000, actual_revenue: 14500, target_pax: 170, actual_pax: 180, target_occupancy: 80, actual_occupancy: 85 },
  { date: '2026-03-04', target_revenue: 13500, actual_revenue: 12800, target_pax: 175, actual_pax: 160, target_occupancy: 82, actual_occupancy: 76 },
  { date: '2026-03-05', target_revenue: 14000, actual_revenue: 15200, target_pax: 180, actual_pax: 195, target_occupancy: 85, actual_occupancy: 90 },
  { date: '2026-03-06', target_revenue: 15000, actual_revenue: 16800, target_pax: 200, actual_pax: 215, target_occupancy: 90, actual_occupancy: 95 },
  { date: '2026-03-07', target_revenue: 15500, actual_revenue: 17500, target_pax: 210, actual_pax: 225, target_occupancy: 92, actual_occupancy: 98 },
];

const MOCK_NATIONALITY_DATA: NationalityData[] = [
  { name: 'Almanya', value: 450 },
  { name: 'İngiltere', value: 320 },
  { name: 'Rusya', value: 280 },
  { name: 'Yerli (TR)', value: 150 },
  { name: 'Diğer', value: 82 },
];

const INITIAL_QUERIES: QueryTemplate[] = [
  {
    id: 1,
    query_name: "Ana Rezervasyon Küpü",
    api_object: "SP_EASYPMS_PULLRESCUBE",
    columns_grouped: "HOTELID,SALEDATE,STAYDATE,CREATEDATE,ACCOMTYPE,SEGMENT,AGENCY,NATIONALITY,ROOMTYPE,BOARDTYPE",
    columns_summed: "ROOM,ADULT,CHILD,ROOMREVENUE,NETROOMREVENUE,PAX",
    is_active: true
  },
  {
    id: 2,
    query_name: "Acente Performans Raporu",
    api_object: "SP_EASYPMS_AGENCY_PERF",
    columns_grouped: "HOTELID,AGENCY,AGENCYGROUP,MARKET",
    columns_summed: "ROOM,ROOMREVENUE,PAX",
    is_active: true
  }
];

const COLORS = ['#0ea5e9', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b'];

// --- YARDIMCI FONKSİYONLAR ---
const formatCurrency = (value: number) => 
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

const formatNumber = (value: number) => 
  new Intl.NumberFormat('tr-TR').format(value);

// --- BİLEŞENLER ---

const KPICard = ({ 
  title, icon: Icon, actual, target, prefix = '', suffix = '', isCurrency = false 
}: { 
  title: string, icon: any, actual: number, target: number, prefix?: string, suffix?: string, isCurrency?: boolean 
}) => {
  const achievementPct = target > 0 ? (actual / target) * 100 : 0;
  const isPositive = achievementPct >= 100;
  
  const displayActual = isCurrency ? formatCurrency(actual) : formatNumber(actual) + suffix;
  const displayTarget = isCurrency ? formatCurrency(target) : formatNumber(target) + suffix;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Icon size={20} strokeWidth={2.5} />
          </div>
          <h3 className="text-slate-500 font-medium text-sm">{title}</h3>
        </div>
        <div className={`flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full ${
          isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
        }`}>
          {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span>{achievementPct.toFixed(1)}%</span>
        </div>
      </div>
      
      <div className="mt-2">
        <div className="text-3xl font-bold text-slate-900 tracking-tight">
          {prefix}{displayActual}
        </div>
        <div className="text-sm text-slate-400 mt-2 font-medium">
          Hedef: <span className="text-slate-600">{prefix}{displayTarget}</span>
        </div>
      </div>
    </div>
  );
};

const DashboardSkeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="h-10 bg-slate-200 rounded-lg w-1/4 mb-8"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl p-6 h-40 border border-slate-100">
          <div className="flex justify-between">
            <div className="h-10 w-10 bg-slate-200 rounded-xl"></div>
            <div className="h-6 w-16 bg-slate-200 rounded-full"></div>
          </div>
          <div className="h-8 bg-slate-200 rounded-md w-1/2 mt-6"></div>
          <div className="h-4 bg-slate-200 rounded-md w-1/3 mt-3"></div>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-2xl h-96 border border-slate-100"></div>
      <div className="bg-white rounded-2xl h-96 border border-slate-100"></div>
    </div>
  </div>
);

// --- YENİ BİLEŞEN: QUERY SETTINGS PANEL ---
const QuerySettingsPanel = () => {
  const [queries, setQueries] = useState<QueryTemplate[]>([]);
  const [formData, setFormData] = useState({
    query_name: '',
    api_object: '',
    columns_grouped: '',
    columns_summed: '',
    is_active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Örnek Hotel ID (Gerçekte auth context'ten gelir)
  const hotelId = 1;

  // Sorguları Getir (Read)
  const fetchQueries = async () => {
    setIsLoading(true);
    try {
      // Gerçek API çağrısı:
      // const response = await fetch(`/api/hotels/${hotelId}/queries`);
      // const data = await response.json();
      // setQueries(data);
      
      // Simülasyon:
      setTimeout(() => {
        setQueries(INITIAL_QUERIES);
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error("Sorgular çekilirken hata:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Yeni Sorgu Ekle (Create)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Gerçek API çağrısı:
      /*
      const response = await fetch(`/api/hotels/${hotelId}/queries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const newQuery = await response.json();
      setQueries([...queries, newQuery]);
      */
      
      // Simülasyon:
      setTimeout(() => {
        const newQuery: QueryTemplate = {
          id: queries.length > 0 ? Math.max(...queries.map(q => q.id)) + 1 : 1,
          ...formData
        };
        setQueries([...queries, newQuery]);
        setFormData({
          query_name: '', api_object: '', columns_grouped: '', columns_summed: '', is_active: true
        });
        setIsSubmitting(false);
      }, 800);
    } catch (error) {
      console.error("Sorgu eklenirken hata:", error);
      setIsSubmitting(false);
    }
  };

  // Sorgu Sil (Delete)
  const handleDelete = async (queryId: number) => {
    if (!window.confirm("Bu sorgu şablonunu silmek istediğinize emin misiniz?")) return;
    
    try {
      // Gerçek API çağrısı:
      // await fetch(`/api/hotels/${hotelId}/queries/${queryId}`, { method: 'DELETE' });
      
      // Simülasyon:
      setQueries(queries.filter(q => q.id !== queryId));
    } catch (error) {
      console.error("Sorgu silinirken hata:", error);
    }
  };

  // Durum Değiştir (Update)
  const toggleStatus = async (query: QueryTemplate) => {
    try {
      const updatedData = { ...query, is_active: !query.is_active };
      
      // Gerçek API çağrısı:
      /*
      const response = await fetch(`/api/hotels/${hotelId}/queries/${query.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      */
      
      // Simülasyon:
      setQueries(queries.map(q => q.id === query.id ? updatedData : q));
    } catch (error) {
      console.error("Durum güncellenirken hata:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* FORM BÖLÜMÜ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Database size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Yeni Sorgu Şablonu Oluştur</h2>
            <p className="text-sm text-slate-500">API'den veri çekerken kullanılacak dinamik parametreleri tanımlayın.</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Sorgu Adı</label>
              <input 
                required
                name="query_name"
                value={formData.query_name}
                onChange={handleInputChange}
                placeholder="Örn: Acente Performans Raporu" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">API Prosedür Adı (Object)</label>
              <input 
                required
                name="api_object"
                value={formData.api_object}
                onChange={handleInputChange}
                placeholder="Örn: SP_EASYPMS_PULLRESCUBE" 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Gruplanacak Sütunlar (COLUMNSGROUPED)</label>
              <textarea 
                required
                name="columns_grouped"
                value={formData.columns_grouped}
                onChange={handleInputChange}
                placeholder="Virgülle ayırarak yazın (Örn: HOTELID,SALEDATE,AGENCY)" 
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm resize-none"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Toplanacak Sütunlar (COLUMNSSUMMED)</label>
              <textarea 
                required
                name="columns_summed"
                value={formData.columns_summed}
                onChange={handleInputChange}
                placeholder="Virgülle ayırarak yazın (Örn: ROOM,ROOMREVENUE,PAX)" 
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm resize-none"
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              Şablonu Ekle
            </button>
          </div>
        </form>
      </div>

      {/* TABLO BÖLÜMÜ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Kayıtlı Sorgu Şablonları</h2>
          <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">
            {queries.length} Sorgu
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-4">Sorgu Adı</th>
                <th className="px-6 py-4">API Prosedürü</th>
                <th className="px-6 py-4">Gruplanan Sütunlar</th>
                <th className="px-6 py-4">Durum</th>
                <th className="px-6 py-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Henüz kayıtlı bir sorgu şablonu bulunmuyor.
                  </td>
                </tr>
              ) : (
                queries.map((query) => (
                  <tr key={query.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{query.query_name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-indigo-600">{query.api_object}</td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs truncate text-slate-500" title={query.columns_grouped}>
                        {query.columns_grouped}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleStatus(query)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          query.is_active 
                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {query.is_active ? <><CheckCircle2 size={14} /> Aktif</> : <><XCircle size={14} /> Pasif</>}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDelete(query.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Sil"
                      >
                        <XCircle size={18} />
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
  );
};

// --- ANA DASHBOARD BİLEŞENİ ---
export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queries'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<DailySummary[]>([]);
  const [nationalityData, setNationalityData] = useState<NationalityData[]>([]);

  const [totals, setTotals] = useState({
    actual_rev: 0, target_rev: 0,
    actual_pax: 0, target_pax: 0,
    actual_occ: 0, target_occ: 0
  });

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setTrendData(MOCK_TREND_DATA);
        setNationalityData(MOCK_NATIONALITY_DATA);

        const totalActualRev = MOCK_TREND_DATA.reduce((sum, item) => sum + item.actual_revenue, 0);
        const totalTargetRev = MOCK_TREND_DATA.reduce((sum, item) => sum + item.target_revenue, 0);
        const totalActualPax = MOCK_TREND_DATA.reduce((sum, item) => sum + item.actual_pax, 0);
        const totalTargetPax = MOCK_TREND_DATA.reduce((sum, item) => sum + item.target_pax, 0);
        
        const avgActualOcc = MOCK_TREND_DATA.reduce((sum, item) => sum + item.actual_occupancy, 0) / MOCK_TREND_DATA.length;
        const avgTargetOcc = MOCK_TREND_DATA.reduce((sum, item) => sum + item.target_occupancy, 0) / MOCK_TREND_DATA.length;

        setTotals({
          actual_rev: totalActualRev, target_rev: totalTargetRev,
          actual_pax: totalActualPax, target_pax: totalTargetPax,
          actual_occ: avgActualOcc, target_occ: avgTargetOcc
        });

      } catch (error) {
        console.error("Veri çekilirken hata oluştu:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER & NAVIGATION */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <Building2 className="text-indigo-600" size={28} />
              Hotel SaaS Platform
            </h1>
            <p className="text-slate-500 mt-1 font-medium">Grand EasyPMS Resort Yönetim Paneli</p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('queries')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'queries' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Database size={18} />
              Sorgu Ayarları
            </button>
          </div>
        </header>

        {/* TAB CONTENT */}
        {activeTab === 'dashboard' ? (
          loading ? (
            <DashboardSkeleton />
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* KPI KARTLARI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title="Toplam Oda Geliri" icon={Hotel} actual={totals.actual_rev} target={totals.target_rev} isCurrency={true} />
                <KPICard title="Toplam Konaklayan (Pax)" icon={Users} actual={totals.actual_pax} target={totals.target_pax} />
                <KPICard title="Ortalama Doluluk Oranı" icon={Percent} actual={Math.round(totals.actual_occ)} target={Math.round(totals.target_occ)} suffix="%" />
              </div>

              {/* GRAFİKLER */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-800">Günlük Gelir Trendi</h3>
                    <p className="text-sm text-slate-500 font-medium">Gerçekleşen vs Hedef (EUR)</p>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => val.split('-')[2] + ' Mart'} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `€${val / 1000}k`} dx={-10} />
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `${label.split('-')[2]} Mart 2026`} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        <Line name="Gerçekleşen Gelir" type="monotone" dataKey="actual_revenue" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        <Line name="Hedef Gelir" type="monotone" dataKey="target_revenue" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                  <div className="mb-2">
                    <h3 className="text-lg font-bold text-slate-800">Uyruk Dağılımı</h3>
                    <p className="text-sm text-slate-500 font-medium">Konaklayan Kişi (Pax)</p>
                  </div>
                  <div className="flex-1 min-h-[300px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={nationalityData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value" stroke="none">
                          {nationalityData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => [`${value} Kişi`, 'Pax']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold text-slate-800">{formatNumber(totals.actual_pax)}</span>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Toplam Pax</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4">
                    {nationalityData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-sm text-slate-600 font-medium truncate">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="animate-in fade-in duration-500">
            <QuerySettingsPanel />
          </div>
        )}
      </div>
    </div>
  );
}
