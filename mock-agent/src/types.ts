// Section 4: Data Models & API Response Structures (from Architectural Plan)

export interface AgentApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface AgentPaginatedResponse<T> extends AgentApiResponse<T[]> {
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// A. Status & Authentication
export interface AgentStatus {
  status: 'active' | 'inactive' | 'error';
  version: string;
  agentDid?: string; // Optional, as per /auth/initiate response
  lastActivity?: string; // Example field
}

// B. Consent Management
export type ConsentStatus = 'active' | 'revoked' | 'expired' | 'pending';

export interface CitizenConsent {
  consentId: string; // Unique identifier for the consent record (e.g., UUID)
  serviceProviderId: string; // DID or unique ID of the service provider
  serviceProviderName: string; // Human-readable name
  dataTypes: string[]; // e.g., ["profile", "health_records.blood_pressure"]
  purpose: string; // Text description of why data is being requested
  status: ConsentStatus;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
  expiresAt?: string; // Optional ISO 8601 timestamp
  dataCustodianId?: string; // Who is holding the data (e.g. agent DID)
  grantedDataTypes?: string[]; // Specific data types granted by this consent
}

// C. Data Access Logs
export interface DataAccessLogEntry {
  logId: string; // Unique identifier for the log entry (e.g., UUID)
  timestamp: string; // ISO 8601 timestamp of the access
  serviceProviderId: string; // DID or unique ID of the accessing service
  serviceProviderName: string; // Human-readable name
  dataType: string; // Specific data type accessed (e.g., "profile.email")
  action: 'read' | 'write' | 'update' | 'delete'; // Type of access
  success: boolean; // Whether the access was successful
  consentId?: string; // Link to the consent record, if applicable
  details?: string; // Additional details or context
}

// D. Notifications
export interface Notification {
  notificationId: string; // Unique identifier (e.g., UUID)
  type: 'consent_request' | 'data_access' | 'security_alert' | 'system_update';
  title: string;
  message: string;
  timestamp: string; // ISO 8601
  isRead: boolean;
  relatedEntityId?: string; // e.g., consentId or logId
  actions?: Array<{ label: string; url?: string; actionType: 'view_consent' | 'mark_read' }>;
}
// E. Citizen Identity Data
export interface PermanentAddress {
  street: string;
  city: string;
  province: string; // Or state
  postalCode: string;
  country: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface CanadianIdentityData {
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  socialInsuranceNumber?: string; // Optional, sensitive
  driversLicenseNumber?: string; // Optional
  healthCardNumber?: string; // Optional, provincial
  permanentAddress: PermanentAddress;
  status: 'Citizen' | 'Permanent Resident' | 'Protected Person' | 'Temporary Resident' | 'Visitor'; // Example statuses
  emergencyContacts?: EmergencyContact[];
  profilePictureUrl?: string; // URL to a profile picture
  // Add other relevant fields as identified
}