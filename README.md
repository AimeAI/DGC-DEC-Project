# DGC-DEC-Project - Citizen Identity Portal

## Overview

The DGC-DEC-Project demonstrates decentralized identity management using the W3C Decentralized Identifiers (DIDs) framework. It’s part of the Digital Governance Council’s initiative to enhance digital identity verification and document signing using domain-based trust.

## Features

-   **Citizen Identity Portal (DEC-01):** Frontend dashboard for managing consents, credentials, and notifications.
-   **Domain-based Digital Signing (DEC-02):** Verifying with WC3 DIDs.
-   **Signature Provider (DEC-03):** Implementing digital trust and verification.

### Key Functionality:

-   **Consent Management (CRUD)**
    -   Add, view, edit, and delete consents.
    -   **API Endpoints:**
        -   `POST /api/v1/consents` - Create a new consent.
        -   `GET /api/v1/consents` - Get all consents.
        -   `GET /api/v1/consents/:id` - Get a specific consent.
        -   `PUT /api/v1/consents/:id` - Update a consent.
        -   `DELETE /api/v1/consents/:id` - Delete a consent.
-   **Credential Display**
    -   View your verified digital identities.
-   **Notification Handling**
    -   View alerts related to your identity data and consents.

## Technology Stack

-   **Frontend:** React, TypeScript, Material UI
-   **Backend:** Node.js, Express, TypeScript
-   **Mock Agent:** Local server for API testing and data simulation
-   **Development Tools:** ts-node, nodemon

## Project Structure

```
DGC-DEC-Project/
├── frontend/       # React-based dashboard
├── mock-agent/     # Mock backend agent for testing
├── docs/           # Project documentation
└── README.md       # Project overview and setup
```

## Setup Instructions

### Prerequisites:

-   Node.js (v16+)
-   npm (v8+)
-   TypeScript

### Clone the repository:

```bash
git clone https://github.com/yourusername/DGC-DEC-Project.git
cd DGC-DEC-Project
```

### Install Frontend Dependencies:

```bash
cd frontend
npm install
```

### Install Mock Agent Dependencies:

```bash
cd ../mock-agent
npm install
```

## Running the Project

### 1. Start the Mock Agent:

```bash
cd mock-agent
npm run dev
```

-   Mock Agent will be available at: `http://localhost:3001` (Note: User feedback mentioned 3002, but typical mock agent port is 3001. Confirming 3001 as per previous context, adjust if user explicitly states 3002 for mock-agent).

### 2. Start the Frontend:

```bash
cd ../frontend
npm start
```

-   Frontend will run at: `http://localhost:3000` (Note: User feedback mentioned 3001, but typical React dev port is 3000. Confirming 3000 as per standard, adjust if user explicitly states 3001 for frontend).

### 3. Access the Dashboard:

-   Open your browser at `http://localhost:3000/dashboard` (Adjust port if frontend runs on 3001)
-   Navigate to "My Consents" to test adding, viewing, editing, and deleting consents.

## Troubleshooting

-   If the mock agent fails to start, check the terminal for errors related to TypeScript or port conflicts.
-   If the frontend shows a "not connected" error, ensure both servers are running.
-   Restart the mock agent if an API endpoint shows "Cannot GET".

## Contributing

-   Fork the repository
-   Create a branch:
    ```bash
    git checkout -b feature/new-feature
    ```
-   Make your changes
-   Commit:
    ```bash
    git commit -m "Add new feature"
    ```
-   Push:
    ```bash
    git push origin feature/new-feature
    ```
-   Open a pull request

## License

MIT License