export const resolveDynamicDate = (value: string): string => {
  if (!value || typeof value !== 'string') return value;

  const today = new Date();
  
  // Format date as YYYY-MM-DD
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (value === '{{TODAY}}') {
    return formatDate(today);
  }
  
  if (value === '{{YESTERDAY}}') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday);
  }

  if (value === '{{TOMORROW}}') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }

  if (value === '{{START_OF_MONTH}}') {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return formatDate(startOfMonth);
  }

  if (value === '{{END_OF_MONTH}}') {
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return formatDate(endOfMonth);
  }

  // Handle {{TODAY+N}} or {{TODAY-N}}
  const match = value.match(/\{\{TODAY([+-])(\d+)\}\}/);
  if (match) {
    const operator = match[1];
    const days = parseInt(match[2], 10);
    const newDate = new Date(today);
    
    if (operator === '+') {
      newDate.setDate(newDate.getDate() + days);
    } else if (operator === '-') {
      newDate.setDate(newDate.getDate() - days);
    }
    
    return formatDate(newDate);
  }

  return value;
};

export const DYNAMIC_DATE_OPTIONS = [
  { label: 'Özel Tarih Seç', value: 'custom' },
  { label: 'Bugün', value: '{{TODAY}}' },
  { label: 'Dün', value: '{{YESTERDAY}}' },
  { label: 'Yarın', value: '{{TOMORROW}}' },
  { label: 'Bugün + 7 Gün', value: '{{TODAY+7}}' },
  { label: 'Bugün + 15 Gün', value: '{{TODAY+15}}' },
  { label: 'Bugün + 30 Gün', value: '{{TODAY+30}}' },
  { label: 'Bugün - 7 Gün', value: '{{TODAY-7}}' },
  { label: 'Bugün - 15 Gün', value: '{{TODAY-15}}' },
  { label: 'Bugün - 30 Gün', value: '{{TODAY-30}}' },
  { label: 'Bu Ayın Başı', value: '{{START_OF_MONTH}}' },
  { label: 'Bu Ayın Sonu', value: '{{END_OF_MONTH}}' }
];
