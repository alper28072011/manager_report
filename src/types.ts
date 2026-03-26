export interface ReportView {
  id?: string;
  name: string;
  hotel_code: string;
  parameters: Record<string, string>;
  visible_columns: Record<string, string[]>;
  created_at?: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo?: any[];
  }
}

export interface DailySummary {
  date: string;
  target_revenue: number;
  actual_revenue: number;
  target_pax: number;
  actual_pax: number;
  target_occupancy: number;
  actual_occupancy: number;
}

export interface NationalityData {
  name: string;
  value: number;
}

export interface ColumnDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  format?: string;
}

export interface ParameterDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date';
  default_value?: string;
}

export interface QueryTemplate {
  id: string;
  query_name: string;
  api_url: string;
  api_object: string;
  payload_template: string;
  response_index: number;
  is_active: boolean;
  column_definitions?: ColumnDefinition[];
  parameter_definitions?: ParameterDefinition[];
  createdAt?: any;
  updatedAt?: any;
}

export interface Hotel {
  id: string;
  hotel_code: string;
  name: string;
  api_key: string;
  is_active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export type AggregationType = 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT';
export type ChartType = 'TABLE' | 'BAR' | 'LINE' | 'PIE';

export interface ReportDimension {
  columnName: string;
  label?: string;
}

export interface ReportMetric {
  columnName: string;
  label?: string;
  aggregation: AggregationType;
}

export interface ReportArea {
  id: string;
  title: string;
  subtitle?: string;
  queryId: string;
  dimensions: ReportDimension[];
  metrics: ReportMetric[];
  chartType: ChartType;
  parameters?: Record<string, string>;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description?: string;
  areas: ReportArea[];
  createdAt?: any;
  updatedAt?: any;
}

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  role: 'super_admin' | 'user';
  allowed_hotels: string[]; // Array of hotel_codes
  createdAt?: any;
  updatedAt?: any;
}
