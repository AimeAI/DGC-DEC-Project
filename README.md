# DGC-DEC-Project
## Project Overview

The DGC-DEC-Project is a digital citizen application designed to demonstrate decentralized identity management using the WC3 Decentralized Identifiers (W3C DIDs) framework. It is part of the Digital Governance Council's initiative to enhance digital identity verification and document signing with domain-based trust.

This project covers:

*   DEC-01: Citizen Identity Portal - A frontend dashboard for managing citizen data.
*   DEC-02: Sign and Verify With My Domain - Leveraging WC3 DIDs for domain-based digital signing.
*   DEC-03: Domain Name Signature Provider - A practical implementation for digital trust and verification.

## Project Structure

```
DGC-DEC-Project/
├── frontend/       # React-based frontend for Citizen Identity Portal
├── mock-agent/     # Mock backend agent for testing and simulation
├── docs/           # Project documentation and specifications
└── README.md       # Project overview and setup instructions
```

## Setup Instructions
### Prerequisites:

*   Node.js (v16+)
*   npm (v8+)
*   TypeScript

### Clone the repository:

```bash
git clone https://github.com/yourusername/DGC-DEC-Project.git
cd DGC-DEC-Project
```

### Install dependencies for frontend:

```bash
cd frontend
npm install
```

### Install dependencies for mock-agent:

```bash
cd ../mock-agent
npm install
```

## Running the Project
### Start the Mock Agent:

```bash
cd mock-agent
npm start
```
*   The server will be running on http://localhost:3002

### Start the Frontend:

```bash
cd ../frontend
PORT=3001 npm start
```
*   The frontend will be accessible at http://localhost:3001

### Access the Dashboard:

Open your browser and visit:
`http://localhost:3001/dashboard`

## Troubleshooting

*   If the frontend does not connect to the mock agent, make sure both are running on the correct ports.
*   Restart the mock agent if the `/api/v1/identity` endpoint shows a "Cannot GET" error.
*   Check the browser console for any frontend errors and the terminal for backend issues.

## Project Goals

*   Demonstrate decentralized identity management through a citizen dashboard.
*   Implement domain-based signing and verification using W3C DIDs.
*   Showcase how trusted identifiers can be managed through existing domain registrars.

## License

MIT License

## Contributing

Feel free to submit pull requests or open issues for improvements.

## Contact

For any questions, reach out to the Digital Governance Council or the project maintainers.