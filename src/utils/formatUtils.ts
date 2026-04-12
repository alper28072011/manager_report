import { DateGranularity } from '../types';

export const formatDateByGranularity = (dateString: string | number | Date, granularity?: DateGranularity) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return String(dateString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (granularity) {
    case 'year':
      return `${year}`;
    case 'month':
      return `${year}-${month}`;
    case 'quarter':
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${year}-Q${quarter}`;
    case 'week':
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
      return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    case 'dayOfWeek':
      const days = ['7-Pazar', '1-Pazartesi', '2-Salı', '3-Çarşamba', '4-Perşembe', '5-Cuma', '6-Cumartesi'];
      return days[date.getDay()];
    case 'day':
    default:
      return `${year}-${month}-${day}`;
  }
};

export const formatDateForDisplay = (sortableDate: string, granularity?: DateGranularity) => {
  if (!sortableDate || sortableDate === '-') return '-';

  try {
    switch (granularity) {
      case 'year':
        return sortableDate;
      case 'month': {
        const [year, month] = sortableDate.split('-');
        const date = new Date(Number(year), Number(month) - 1);
        return new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(date);
      }
      case 'quarter': {
        const [year, q] = sortableDate.split('-');
        return `${q.replace('Q', '')}. Çeyrek ${year}`;
      }
      case 'week': {
        const [year, w] = sortableDate.split('-');
        return `${w.replace('W', '')}. Hafta ${year}`;
      }
      case 'dayOfWeek': {
        return sortableDate.split('-')[1] || sortableDate;
      }
      case 'day':
      default: {
        const [year, month, day] = sortableDate.split('-');
        if (year && month && day) {
          return `${day}.${month}.${year}`;
        }
        return sortableDate;
      }
    }
  } catch (e) {
    return sortableDate;
  }
};

export const formatForDisplay = (value: any, type?: string, granularity?: DateGranularity) => {
  if (value === null || value === undefined) return '-';
  
  if (type === 'date') {
    const sortable = formatDateByGranularity(value, granularity);
    return formatDateForDisplay(sortable, granularity);
  }
  
  if (type === 'percentage') {
    return new Intl.NumberFormat('tr-TR', { style: 'percent', minimumFractionDigits: 2 }).format(Number(value) / 100);
  }
  
  if (type === 'currency') {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(value));
  }
  
  if (type === 'number' || typeof value === 'number') {
    return new Intl.NumberFormat('tr-TR').format(Number(value));
  }
  
  return String(value);
};
