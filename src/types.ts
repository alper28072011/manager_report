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

export interface QueryTemplate {
  id: string;
  query_name: string;
  api_url: string;
  api_object: string;
  payload_template: string;
  response_index: number;
  is_active: boolean;
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

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  role: 'super_admin' | 'user';
  allowed_hotels: string[]; // Array of hotel_codes
  createdAt?: any;
  updatedAt?: any;
}
