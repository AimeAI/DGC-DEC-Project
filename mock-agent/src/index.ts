import express, { Express, Request, Response, NextFunction, RequestHandler, Router } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  AgentApiResponse,
  AgentPaginatedResponse,
  AgentStatus,
  CitizenConsent,
  ConsentStatus,
  DataAccessLogEntry,
  Notification,
  CanadianIdentityData // Added
} from './types';

const app: Express = express();
const port = process.env.PORT || 3002;

const customCorsMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*'); // Or 'http://localhost:3001'
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Browsers send an OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.sendStatus(200); // OK status for preflight
    return;
  }

  next(); // Pass control to the next middleware function
};

// Middleware
app.use(cors({ origin: 'http://localhost:3001' }));
app.use(express.json()); // Using express.json() as per Express 4.16+
app.use('/', customCorsMiddleware);

// In-memory data stores
let consents: CitizenConsent[] = [];
let dataAccessLogs: DataAccessLogEntry[] = [];
let notifications: Notification[] = [];

const MOCK_AGENT_DID = "did:mock:local-agent-123";
const API_VERSION = "0.1.0";

// Helper to create a standard API response
function createApiResponse<T>(data?: T, error?: { code: string; message: string }): AgentApiResponse<T> {
  return {
    success: !error,
    data: data,
    error: error,
    timestamp: new Date().toISOString(),
  };
}

// Helper to create a paginated API response
function createPaginatedResponse<T>(
  dataArray: T[],
  page: number,
  pageSize: number
): AgentPaginatedResponse<T> {
  const totalItems = dataArray.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedData = dataArray.slice((page - 1) * pageSize, page * pageSize);

  return {
    success: true,
    data: paginatedData,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
    timestamp: new Date().toISOString(),
  };
}

// Mock Identity Data
const mockIdentity: CanadianIdentityData = {
  fullName: 'John Alistair Doe',
  dateOfBirth: '1985-03-15',
  socialInsuranceNumber: '987-654-321',
  driversLicenseNumber: 'D1234-56789-00000',
  healthCardNumber: '9876543210 BC',
  permanentAddress: {
    street: '456 Oak Avenue',
    city: 'Vancouver',
    province: 'BC',
    postalCode: 'V6B 1A2',
    country: 'Canada',
  },
  status: 'Citizen',
  emergencyContacts: [
    { name: 'Jane Mary Doe', relationship: 'Spouse', phone: '555-0202', email: 'jane.doe@example.com' },
    { name: 'Robert Smith', relationship: 'Friend', phone: '555-0303' },
  ],
  profilePictureUrl: 'https://via.placeholder.com/150/007bff/FFFFFF?text=JD', // Placeholder image
};

const apiRouter: Router = express.Router();

// A. Status & Authentication
apiRouter.get('/status', (req: Request, res: Response, next: NextFunction) => {
  console.log('Mock Agent /api/v1/status endpoint hit'); // Add this log
  res.json({
    success: true,
    data: {
      isRunning: true,
      version: '1.0.0-simplified' // Indicate this is a simplified response
    }
  });
});

apiRouter.post('/auth/initiate', (req: Request, res: Response, next: NextFunction) => {
  // Simulate session token generation
  const sessionToken = uuidv4();
  res.json(createApiResponse({ sessionToken, agentDid: MOCK_AGENT_DID }));
});

// New Identity Endpoint
apiRouter.get('/identity', (req: Request, res: Response, next: NextFunction) => {
  // Simulate a small delay
  setTimeout(() => {
    res.json(createApiResponse(mockIdentity));
  }, 500);
});

// B. Consent Management
apiRouter.get('/consents', ((req: Request, res: Response, _next: NextFunction) => {
  const { status, page = '1', pageSize = '10' } = req.query;
  let filteredConsents = consents;

  if (status && typeof status === 'string') {
    filteredConsents = consents.filter(c => c.status === status);
  }
 
            console.log('[API /consents] Sending consents:', JSON.stringify(filteredConsents, null, 2));
  res.json(createPaginatedResponse(filteredConsents, parseInt(page as string), parseInt(pageSize as string)));
}) as RequestHandler);

// POST /api/v1/consents - Create a new consent
apiRouter.post('/consents', ((req: Request, res: Response, _next: NextFunction) => {
  const { serviceProviderId, serviceProviderName, dataTypes, purpose, status, expiresAt, grantedDataTypes } = req.body;

  // Basic validation for required fields
  if (!serviceProviderId || !serviceProviderName || !Array.isArray(dataTypes) || dataTypes.length === 0 || !purpose) {
    return res.status(400).json(createApiResponse(undefined, {
      code: 'BAD_REQUEST',
      message: 'Missing or invalid required consent data. Ensure serviceProviderId, serviceProviderName, dataTypes (non-empty array), and purpose are provided.'
    }));
  }

  const now = new Date().toISOString();
  const newConsent: CitizenConsent = {
    consentId: uuidv4(),
    serviceProviderId,
    serviceProviderName,
    dataTypes,
    purpose,
    status: status || 'active', // Default to 'active' if not provided by client
    createdAt: now,
    updatedAt: now,
    dataCustodianId: MOCK_AGENT_DID, // Set the data custodian
    ...(expiresAt && { expiresAt }), // Conditionally add expiresAt if provided
    grantedDataTypes: grantedDataTypes || [], // Default to empty array if not provided
  };

  consents.push(newConsent);
  res.status(201).json(createApiResponse(newConsent));
}) as RequestHandler);

apiRouter.get('/consents/:consentId', ((req: Request, res: Response, _next: NextFunction) => {
  const consent = consents.find(c => c.consentId === req.params.consentId);
  if (consent) {
    res.json(createApiResponse(consent));
  } else {
    res.status(404).json(createApiResponse(undefined, { code: 'NOT_FOUND', message: 'Consent not found' }));
  }
}) as RequestHandler);

apiRouter.post('/consents/:consentId/revoke', (req: Request, res: Response, next: NextFunction) => {
  const consentIndex = consents.findIndex(c => c.consentId === req.params.consentId);
  if (consentIndex > -1) {
    consents[consentIndex].status = 'revoked';
    consents[consentIndex].updatedAt = new Date().toISOString();
    res.json(createApiResponse(consents[consentIndex]));
  } else {
    res.status(404).json(createApiResponse(undefined, { code: 'NOT_FOUND', message: 'Consent not found' }));
  }
});

apiRouter.put('/consents/:consentId', ((req: Request, res: Response, _next: NextFunction) => {
  const consentIndex = consents.findIndex(c => c.consentId === req.params.consentId);
  if (consentIndex > -1) {
    // For mock, allow updating purpose and expiresAt. In reality, this would be more complex.
    const { purpose, expiresAt, dataTypes, status, grantedDataTypes } = req.body;
    if (purpose) consents[consentIndex].purpose = purpose;
    if (expiresAt) consents[consentIndex].expiresAt = expiresAt;
    if (dataTypes) consents[consentIndex].dataTypes = dataTypes;
    if (status) consents[consentIndex].status = status as ConsentStatus;
    if (grantedDataTypes) consents[consentIndex].grantedDataTypes = grantedDataTypes;
    consents[consentIndex].updatedAt = new Date().toISOString();
    res.json(createApiResponse(consents[consentIndex]));
  } else {
    res.status(404).json(createApiResponse(undefined, { code: 'NOT_FOUND', message: 'Consent not found' }));
  }
}) as RequestHandler);

// DELETE /api/v1/consents/:consentId - Delete a consent
apiRouter.delete('/consents/:consentId', ((req: Request, res: Response, _next: NextFunction) => {
  const consentIdToDelete = req.params.consentId;
  const consentIndex = consents.findIndex(c => c.consentId === consentIdToDelete);

  if (consentIndex > -1) {
    consents.splice(consentIndex, 1); // Remove the consent from the array
    res.status(204).send(); // No content response for successful deletion
  } else {
    res.status(404).json(createApiResponse(undefined, { code: 'NOT_FOUND', message: 'Consent not found' }));
  }
}) as RequestHandler);

// C. Data Access Logs
apiRouter.get('/data-access-logs', (req: Request, res: Response, next: NextFunction) => {
  const { page = '1', pageSize = '10' } = req.query;
            console.log('[API /data-access-logs] Sending logs:', JSON.stringify(dataAccessLogs, null, 2));
  res.json(createPaginatedResponse(dataAccessLogs, parseInt(page as string), parseInt(pageSize as string)));
});

apiRouter.get('/data-access-logs/export', (req: Request, res: Response, next: NextFunction) => {
  // For now, just return a JSON array of all logs
  res.json(createApiResponse(dataAccessLogs));
});

// D. Notifications
apiRouter.get('/notifications', (req: Request, res: Response, next: NextFunction) => {
  const { unreadOnly, page = '1', pageSize = '10' } = req.query;
  let filteredNotifications = notifications;

  if (unreadOnly === 'true') {
    filteredNotifications = notifications.filter(n => !n.isRead);
  }
            console.log('[API /notifications] Sending notifications:', JSON.stringify(filteredNotifications, null, 2));
  res.json(createPaginatedResponse(filteredNotifications, parseInt(page as string), parseInt(pageSize as string)));
});

apiRouter.post('/notifications/:notificationId/mark-read', (req: Request, res: Response, next: NextFunction) => {
  const notificationIndex = notifications.findIndex(n => n.notificationId === req.params.notificationId);
  if (notificationIndex > -1) {
    notifications[notificationIndex].isRead = true;
    res.json(createApiResponse(notifications[notificationIndex]));
  } else {
    res.status(404).json(createApiResponse(undefined, { code: 'NOT_FOUND', message: 'Notification not found' }));
  }
});

// Mount the API router
app.use('/api/v1', apiRouter);

// Simple root path response
app.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.send('Mock Local Agent is running! API is available at /api/v1');
});

// Error handling middleware (optional, but good practice)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json(createApiResponse(undefined, { code: 'INTERNAL_SERVER_ERROR', message: 'Something broke!' }));
});


// Sample data (optional, for testing)
function addSampleData() {
    const now = new Date().toISOString();
    const consent1Id = uuidv4();
    const consent2Id = uuidv4();

    consents = [
        { consentId: consent1Id, serviceProviderId: 'did:example:sp1', serviceProviderName: 'Health Portal X', dataTypes: ['profile.name', 'health.heartrate'], purpose: 'Display health dashboard', status: 'active', createdAt: now, updatedAt: now, dataCustodianId: MOCK_AGENT_DID, grantedDataTypes: ['profile.name', 'health.heartrate'] },
        { consentId: consent2Id, serviceProviderId: 'did:example:sp2', serviceProviderName: 'GovService Y', dataTypes: ['profile.address'], purpose: 'Verify address for benefits', status: 'pending', createdAt: now, updatedAt: now, dataCustodianId: MOCK_AGENT_DID, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), grantedDataTypes: ['profile.address'] },
        { consentId: uuidv4(), serviceProviderId: 'did:example:sp3', serviceProviderName: 'Old Service Z', dataTypes: ['profile.email'], purpose: 'Newsletter subscription', status: 'revoked', createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), dataCustodianId: MOCK_AGENT_DID, grantedDataTypes: [] },
    ];

    dataAccessLogs = [
        { logId: uuidv4(), timestamp: now, serviceProviderId: 'did:example:sp1', serviceProviderName: 'Health Portal X', dataType: 'health.heartrate', action: 'read', success: true, consentId: consent1Id },
        { logId: uuidv4(), timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), serviceProviderId: 'did:example:sp1', serviceProviderName: 'Health Portal X', dataType: 'profile.name', action: 'read', success: true, consentId: consent1Id },
        { logId: uuidv4(), timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), serviceProviderId: 'did:example:sp2', serviceProviderName: 'GovService Y', dataType: 'profile.address', action: 'read', success: false, details: 'User not found in external system' },
    ];

    notifications = [
        { notificationId: uuidv4(), type: 'consent_request', title: 'New Consent Request', message: 'GovService Y is requesting access to your address.', timestamp: now, isRead: false, relatedEntityId: consent2Id, actions: [{label: "View Consent", actionType: "view_consent"}] },
        { notificationId: uuidv4(), type: 'data_access', title: 'Data Accessed', message: 'Health Portal X accessed your heart rate data.', timestamp: now, isRead: false, relatedEntityId: dataAccessLogs[0].logId },
        { notificationId: uuidv4(), type: 'security_alert', title: 'Failed Login Attempt', message: 'An unsuccessful login attempt was made to your account.', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), isRead: true },
    ];
    console.log('[server]: Sample data loaded.');
    console.log('[addSampleData] Consents populated:', JSON.stringify(consents, null, 2));
    console.log('[addSampleData] DataAccessLogs populated:', JSON.stringify(dataAccessLogs, null, 2));
    console.log('[addSampleData] Notifications populated:', JSON.stringify(notifications, null, 2));
}

app.listen(port, () => {
  console.log(`[server]: Mock Local Agent is running at http://localhost:${port}`);
  console.log(`[server]: API available at http://localhost:${port}/api/v1`);

  addSampleData();
});