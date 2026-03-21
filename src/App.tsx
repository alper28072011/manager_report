import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Hotel, Users, Percent, Calendar, Loader2, Building2 
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

// --- MOCK VERİ (BACKEND SİMÜLASYONU) ---
// Gerçek senaryoda bu veri Phase 3'te yazdığımız FastAPI'den gelecek.
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

const COLORS = ['#0ea5e9', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b'];

// --- YARDIMCI FONKSİYONLAR ---
const formatCurrency = (value: number) => 
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

const formatNumber = (value: number) => 
  new Intl.NumberFormat('tr-TR').format(value);

// --- BİLEŞENLER ---

// 1. KPI Kartı Bileşeni
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

// 2. Yükleniyor (Skeleton) Bileşeni
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

// --- ANA DASHBOARD BİLEŞENİ ---
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<DailySummary[]>([]);
  const [nationalityData, setNationalityData] = useState<NationalityData[]>([]);

  // Toplamları hesaplamak için state'ler
  const [totals, setTotals] = useState({
    actual_rev: 0, target_rev: 0,
    actual_pax: 0, target_pax: 0,
    actual_occ: 0, target_occ: 0
  });

  useEffect(() => {
    // API İstek Simülasyonu (Gerçekte fetch('/api/reports/21390/daily-summary') yapılacak)
    const fetchData = async () => {
      try {
        setLoading(true);
        // Ağ gecikmesini simüle et (1.5 saniye)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Verileri state'e yaz
        setTrendData(MOCK_TREND_DATA);
        setNationalityData(MOCK_NATIONALITY_DATA);

        // Toplam KPI'ları hesapla
        const totalActualRev = MOCK_TREND_DATA.reduce((sum, item) => sum + item.actual_revenue, 0);
        const totalTargetRev = MOCK_TREND_DATA.reduce((sum, item) => sum + item.target_revenue, 0);
        const totalActualPax = MOCK_TREND_DATA.reduce((sum, item) => sum + item.actual_pax, 0);
        const totalTargetPax = MOCK_TREND_DATA.reduce((sum, item) => sum + item.target_pax, 0);
        
        // Doluluk oranı ortalaması
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
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <Building2 className="text-indigo-600" size={28} />
              Otel Performans Özeti
            </h1>
            <p className="text-slate-500 mt-1 font-medium">Grand EasyPMS Resort - Mart 2026</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm text-sm font-medium text-slate-600">
            <Calendar size={18} className="text-slate-400" />
            <span>01 Mart - 07 Mart 2026</span>
          </div>
        </header>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* KPI KARTLARI (GRID) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KPICard 
                title="Toplam Oda Geliri" 
                icon={Hotel} 
                actual={totals.actual_rev} 
                target={totals.target_rev} 
                isCurrency={true}
              />
              <KPICard 
                title="Toplam Konaklayan (Pax)" 
                icon={Users} 
                actual={totals.actual_pax} 
                target={totals.target_pax} 
              />
              <KPICard 
                title="Ortalama Doluluk Oranı" 
                icon={Percent} 
                actual={Math.round(totals.actual_occ)} 
                target={Math.round(totals.target_occ)} 
                suffix="%" 
              />
            </div>

            {/* GRAFİKLER (GRID) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* GELİR TRENDİ (ÇİZGİ GRAFİĞİ) - 2 SÜTUN KAPLAR */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800">Günlük Gelir Trendi</h3>
                  <p className="text-sm text-slate-500 font-medium">Gerçekleşen vs Hedef (EUR)</p>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        tickFormatter={(val) => val.split('-')[2] + ' Mart'}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 12 }}
                        tickFormatter={(val) => `€${val / 1000}k`}
                        dx={-10}
                      />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `${label.split('-')[2]} Mart 2026`}
                      />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                      <Line 
                        name="Gerçekleşen Gelir" 
                        type="monotone" 
                        dataKey="actual_revenue" 
                        stroke="#4f46e5" 
                        strokeWidth={3} 
                        dot={{ r: 4, strokeWidth: 2 }} 
                        activeDot={{ r: 6 }} 
                      />
                      <Line 
                        name="Hedef Gelir" 
                        type="monotone" 
                        dataKey="target_revenue" 
                        stroke="#cbd5e1" 
                        strokeWidth={2} 
                        strokeDasharray="5 5" 
                        dot={false} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* UYRUK DAĞILIMI (PASTA GRAFİĞİ) - 1 SÜTUN KAPLAR */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                <div className="mb-2">
                  <h3 className="text-lg font-bold text-slate-800">Uyruk Dağılımı</h3>
                  <p className="text-sm text-slate-500 font-medium">Konaklayan Kişi (Pax)</p>
                </div>
                <div className="flex-1 min-h-[300px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={nationalityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {nationalityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`${value} Kişi`, 'Pax']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Ortadaki Toplam Yazısı */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-slate-800">
                      {formatNumber(totals.actual_pax)}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Toplam Pax
                    </span>
                  </div>
                </div>
                
                {/* Özel Legend (Açıklama) */}
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
          </>
        )}
      </div>
    </div>
  );
}
