# DEC-01: Pseudocode for Core Functions

This document outlines the high-level pseudocode for the core functions of the Empowering Citizen-Centric Data Sharing solution (DEC-01).

## 1. Citizen Consent Granting Flow

```pseudocode
FUNCTION GrantConsent (CitizenID, DataSharingRequest)

  // INPUT: CitizenID, DataSharingRequest (contains ConsumerDID, RequestedDataTypes, Purpose, RequestedDuration)
  // OUTPUT: ConsentReceiptID OR Error

  // Step 1: Present Data Sharing Request Details to Citizen
  System.DisplayToCitizen(
    ConsumerIdentity: ResolveDID(DataSharingRequest.ConsumerDID),
    DataRequested: DataSharingRequest.RequestedDataTypes,
    PurposeOfUse: DataSharingRequest.Purpose,
    AccessDuration: DataSharingRequest.RequestedDuration,
    GranularOptions: GetGranularConsentOptions(DataSharingRequest.RequestedDataTypes) // e.g., select/deselect specific attributes
  )

  // Step 2: Citizen Reviews and Makes a Decision
  CitizenDecision = Citizen.Interface.AwaitDecision() // (Approve, Deny, ApproveWithModifications)

  // Step 3: Process Citizen's Decision
  IF CitizenDecision.Action == "Deny" THEN
    LogAuditEvent("ConsentDenied", CitizenID, DataSharingRequest.ConsumerDID, DataSharingRequest.RequestedDataTypes, DataSharingRequest.Purpose, "Citizen denied request")
    RETURN Error("Consent denied by citizen")
  END IF

  // Step 4: Create Consent Record
  ConsentRecord = CREATE NewConsentRecord (
    ConsentID: GenerateUniqueID(),
    CitizenID: CitizenID,
    ConsumerDID: DataSharingRequest.ConsumerDID,
    GrantedDataTypes: CitizenDecision.Modifications.GrantedDataTypes OR DataSharingRequest.RequestedDataTypes,
    Purpose: DataSharingRequest.Purpose,
    GrantTimestamp: CurrentTimestamp(),
    ExpiryTimestamp: CalculateExpiry(CurrentTimestamp(), CitizenDecision.Modifications.Duration OR DataSharingRequest.RequestedDuration),
    Status: "Active",
    ConsentConstraints: CitizenDecision.Modifications.Constraints // e.g., anonymization level
  )

  // Step 5: Store Consent Record Securely (e.g., in Citizen's PDS or a dedicated Consent Registry)
  SecureStorage.Save("ConsentStore", ConsentRecord.ConsentID, ConsentRecord)

  // Step 6: Generate Verifiable Consent Receipt
  ConsentReceipt = GenerateVerifiableCredential (
    Type: "VerifiableConsentReceipt",
    Issuer: SystemDID, // The system itself or a trusted consent service
    Subject: CitizenID,
    CredentialSubject: {
      ConsentID: ConsentRecord.ConsentID,
      ConsumerDID: ConsentRecord.ConsumerDID,
      GrantedData: ConsentRecord.GrantedDataTypes,
      Purpose: ConsentRecord.Purpose,
      GrantTimestamp: ConsentRecord.GrantTimestamp,
      ExpiryTimestamp: ConsentRecord.ExpiryTimestamp
    }
  )
  SignVerifiableCredential(ConsentReceipt, SystemPrivateKey)

  // Step 7: Provide Receipt to Citizen (and optionally to Consumer if agreed)
  Citizen.PDS.Store(ConsentReceipt)
  // IF (PolicyAllowsConsumerReceipt) THEN
  //   SecureChannel.Send(DataSharingRequest.ConsumerDID, ConsentReceipt)
  // END IF

  // Step 8: Log Audit Event
  LogAuditEvent("ConsentGranted", CitizenID, ConsentRecord.ConsentID, ConsentRecord.ConsumerDID, ConsentRecord.GrantedDataTypes, ConsentRecord.Purpose, ConsentRecord.ExpiryTimestamp)

  RETURN ConsentRecord.ConsentID
END FUNCTION
```

## 2. Data Access Request & Consent Verification Flow (by Data Consumer via Secure Gateway)

```pseudocode
FUNCTION VerifyDataAccessRequest (ConsumerAuthToken, RequestedCitizenDID, RequestedDataTypes, RequestedPurpose)

  // INPUT: ConsumerAuthToken, RequestedCitizenDID, RequestedDataTypes, RequestedPurpose
  // OUTPUT: AccessDecision (Granted/Denied), ConsentID (if granted), Error (if applicable)

  // Step 1: Authenticate Data Consumer
  ConsumerIdentity = AuthenticationService.VerifyToken(ConsumerAuthToken)
  IF ConsumerIdentity == null THEN
    LogAuditEvent("DataAccessAttemptFailed", "UnknownConsumer", RequestedCitizenDID, RequestedDataTypes, RequestedPurpose, "Authentication failed")
    RETURN AccessDecision("Denied", Reason: "Authentication Failed")
  END IF
  ConsumerDID = ConsumerIdentity.DID

  LogAuditEvent("DataAccessRequestReceived", ConsumerDID, RequestedCitizenDID, RequestedDataTypes, RequestedPurpose, "Request initiated")

  // Step 2: Retrieve Relevant Consent Records
  // Query based on CitizenDID, ConsumerDID, and potentially data types/purpose for efficiency
  PotentialConsents = SecureStorage.Query("ConsentStore",
    FilterBy: {
      CitizenID: RequestedCitizenDID,
      ConsumerDID: ConsumerDID,
      Status: "Active" // Only consider active consents
    }
  )

  IF IsEmpty(PotentialConsents) THEN
    LogAuditEvent("DataAccessDenied", ConsumerDID, RequestedCitizenDID, RequestedDataTypes, RequestedPurpose, "No active consent found for consumer/citizen pair")
    RETURN AccessDecision("Denied", Reason: "No active consent found")
  END IF

  // Step 3: Verify Consent Validity for the Specific Request
  MatchingConsent = null
  FOR EACH ConsentRecord IN PotentialConsents DO
    // Check Expiry
    IF CurrentTimestamp() > ConsentRecord.ExpiryTimestamp THEN
      ConsentRecord.Status = "Expired"
      SecureStorage.Update("ConsentStore", ConsentRecord.ConsentID, ConsentRecord) // Mark as expired
      LogAuditEvent("ConsentExpired", RequestedCitizenDID, ConsentRecord.ConsentID, ConsumerDID, "Consent found expired during access check")
      CONTINUE // Check next consent
    END IF

    // Check Purpose Match
    IF ConsentRecord.Purpose != RequestedPurpose THEN
      CONTINUE // Purpose mismatch
    END IF

    // Check Data Type Match (requested data must be a subset of or equal to granted data)
    IF NOT IsSubset(RequestedDataTypes, ConsentRecord.GrantedDataTypes) THEN
      CONTINUE // Data type mismatch
    END IF

    // Additional constraint checks (e.g., frequency, geo-location if applicable)
    // IF NOT CheckConsentConstraints(ConsentRecord.ConsentConstraints, CurrentRequestContext) THEN
    //   CONTINUE
    // END IF

    MatchingConsent = ConsentRecord
    BREAK // Found a valid, matching consent
  END FOR

  // Step 4: Make Access Decision
  IF MatchingConsent == null THEN
    LogAuditEvent("DataAccessDenied", ConsumerDID, RequestedCitizenDID, RequestedDataTypes, RequestedPurpose, "No matching valid consent found")
    RETURN AccessDecision("Denied", Reason: "No matching valid consent")
  ELSE
    LogAuditEvent("DataAccessApproved", ConsumerDID, RequestedCitizenDID, RequestedDataTypes, RequestedPurpose, "Consent verified", ConsentID: MatchingConsent.ConsentID)
    RETURN AccessDecision("Granted", ConsentID: MatchingConsent.ConsentID, Constraints: MatchingConsent.ConsentConstraints)
  END IF
END FUNCTION
```

## 3. Secure Data Retrieval Flow (Post-Consent Verification)

```pseudocode
FUNCTION RetrieveDataSecurely (GatewayAuthToken, CitizenDID, GrantedDataTypes, ConsentID, ConsumerDID, ConsentConstraints)

  // INPUT: GatewayAuthToken (authorizing the gateway), CitizenDID, GrantedDataTypes, ConsentID, ConsumerDID, ConsentConstraints
  // OUTPUT: SecuredDataPackage OR Error

  // Step 1: Gateway Authenticates to PDS/Source System
  // This might involve the PDS verifying the Gateway's DID and its role.
  PDS_AuthResult = PDS.VerifyGatewayAuthority(GatewayAuthToken, Operation: "ReadData", CitizenDID: CitizenDID)
  IF PDS_AuthResult != "Authorized" THEN
    LogAuditEvent("DataRetrievalFailed", "Gateway", CitizenDID, GrantedDataTypes, ConsumerDID, "Gateway authorization to PDS failed", ConsentID: ConsentID)
    RETURN Error("Gateway not authorized by PDS")
  END IF

  // Step 2: PDS/Source System Retrieves Raw Data
  // PDS internally checks if the data types are available for the citizen.
  RawData = PDS.FetchData(CitizenDID, GrantedDataTypes)
  IF RawData == null OR IsEmpty(RawData) THEN
    LogAuditEvent("DataRetrievalFailed", "Gateway", CitizenDID, GrantedDataTypes, ConsumerDID, "Data not found or PDS error", ConsentID: ConsentID)
    RETURN Error("Data not found in PDS or PDS error")
  END IF

  // Step 3: Apply Transformations/Anonymization as per Consent Terms
  ProcessedData = RawData
  IF ConsentConstraints.AnonymizationRequired == true THEN
    ProcessedData = AnonymizationService.Anonymize(RawData, ConsentConstraints.AnonymizationLevel, GrantedDataTypes)
  END IF
  // Apply other transformations based on ConsentConstraints (e.g., filtering, aggregation)
  ProcessedData = TransformationService.Apply(ProcessedData, ConsentConstraints.Transformations)


  // Step 4: Package Data Securely
  // Encrypt data for the Data Consumer using their public key (obtained from their DID document)
  ConsumerPublicKey = DIDResolver.GetPublicKey(ConsumerDID, KeyUsage: "Encryption")
  IF ConsumerPublicKey == null THEN
      LogAuditEvent("DataTransmissionSetupFailed", "Gateway", CitizenDID, GrantedDataTypes, ConsumerDID, "Failed to retrieve consumer public key", ConsentID: ConsentID)
      RETURN Error("Cannot retrieve consumer public key for encryption")
  END IF
  EncryptedData = EncryptionService.Encrypt(ProcessedData, ConsumerPublicKey)

  SecuredDataPackage = CREATE NewPackage (
    Payload: EncryptedData,
    Metadata: {
      CitizenDID: CitizenDID,
      GrantedDataTypes: GrantedDataTypes, // or a descriptor of the processed data
      ConsentID: ConsentID,
      Timestamp: CurrentTimestamp()
    }
  )

  // Step 5: Securely Transmit Data to Data Consumer
  // This would typically be over a mutually authenticated TLS channel.
  TransmissionStatus = SecureChannel.SendData(ConsumerDID, SecuredDataPackage)

  IF TransmissionStatus == "Success" THEN
    LogAuditEvent("DataRetrievedAndSent", "Gateway", CitizenDID, GrantedDataTypes, ConsumerDID, "Data securely sent to consumer", ConsentID: ConsentID)
    RETURN SecuredDataPackage // Or just a success confirmation
  ELSE
    LogAuditEvent("DataTransmissionFailed", "Gateway", CitizenDID, GrantedDataTypes, ConsumerDID, "Failed to transmit data to consumer", ConsentID: ConsentID)
    RETURN Error("Data transmission failed")
  END IF
END FUNCTION
```

## 4. Citizen Consent Revocation Flow

```pseudocode
FUNCTION RevokeConsent (CitizenID, ConsentIDToRevoke)

  // INPUT: CitizenID, ConsentIDToRevoke
  // OUTPUT: RevocationStatus (Success/Failure), Error (if applicable)

  // Step 1: Citizen Authenticates (assumed prior to calling this function, or part of it)
  // AuthenticateCitizen(CitizenCredentials)

  // Step 2: Retrieve Active Consents for the Citizen (for display and selection)
  // This step is typically part of the UI flow leading to revocation.
  // ActiveConsents = SecureStorage.Query("ConsentStore", FilterBy: {CitizenID: CitizenID, Status: "Active"})
  // System.DisplayActiveConsents(ActiveConsents)
  // CitizenSelectsConsentToRevoke(ConsentIDToRevoke) from the displayed list.

  // Step 3: Retrieve the Specific Consent Record
  ConsentRecord = SecureStorage.Get("ConsentStore", ConsentIDToRevoke)

  IF ConsentRecord == null THEN
    LogAuditEvent("ConsentRevocationFailed", CitizenID, ConsentIDToRevoke, "N/A", "Consent record not found")
    RETURN RevocationStatus("Failure", Reason: "Consent record not found")
  END IF

  // Step 4: Verify Ownership and Status
  IF ConsentRecord.CitizenID != CitizenID THEN
    LogAuditEvent("ConsentRevocationFailed", CitizenID, ConsentIDToRevoke, ConsentRecord.ConsumerDID, "Citizen not authorized to revoke this consent")
    RETURN RevocationStatus("Failure", Reason: "Not authorized to revoke this consent")
  END IF

  IF ConsentRecord.Status == "Revoked" OR ConsentRecord.Status == "Expired" THEN
    LogAuditEvent("ConsentRevocationAttempted", CitizenID, ConsentIDToRevoke, ConsentRecord.ConsumerDID, "Consent already inactive (revoked/expired)")
    RETURN RevocationStatus("Success", Message: "Consent already inactive") // Or "NoActionNeeded"
  END IF

  // Step 5: Mark Consent as Revoked
  ConsentRecord.Status = "Revoked"
  ConsentRecord.RevocationTimestamp = CurrentTimestamp()
  SecureStorage.Update("ConsentStore", ConsentIDToRevoke, ConsentRecord)

  // Step 6: Log Audit Event for Revocation
  LogAuditEvent("ConsentRevoked", CitizenID, ConsentIDToRevoke, ConsentRecord.ConsumerDID, ConsentRecord.GrantedDataTypes, ConsentRecord.Purpose, "Consent successfully revoked by citizen")

  // Step 7: (Optional but Recommended) Notify Affected Data Consumer
  // This notification should be best-effort and secure.
  // It might be via a pre-established notification endpoint from the consumer's DID.
  NotificationPayload = CREATE NewNotification (
    Type: "ConsentRevocationNotice",
    ConsentID: ConsentIDToRevoke,
    CitizenDID: CitizenID, // or a pseudonymized identifier
    RevocationTimestamp: ConsentRecord.RevocationTimestamp
  )
  // NotificationService.Send(ConsentRecord.ConsumerDID, NotificationPayload)
  // LogAuditEvent("ConsumerNotifiedOfRevocation", CitizenID, ConsentIDToRevoke, ConsentRecord.ConsumerDID, "Notification sent")

  RETURN RevocationStatus("Success")
END FUNCTION
```

## 5. Audit Logging for Data Sharing & Consent Events

```pseudocode
// This is a conceptual function representing the audit logging mechanism.
// It would be called by other functions at appropriate points.

FUNCTION LogAuditEvent (EventType, ActorID, SubjectID, TargetResource, ActionDetails, [AdditionalContext])

  // INPUTS:
  //   EventType: String (e.g., "ConsentGranted", "DataAccessRequestReceived", "DataRetrievedAndSent", "ConsentRevoked")
  //   ActorID: String (DID or unique identifier of the entity performing the action, e.g., CitizenDID, ConsumerDID, GatewayID)
  //   SubjectID: String (DID or unique identifier of the entity being acted upon, e.g., CitizenDID for data access, ConsentID for revocation)
  //   TargetResource: String or Object (Identifier or description of the resource involved, e.g., list of data types, specific data item ID)
  //   ActionDetails: String (Description of the action taken or outcome)
  //   AdditionalContext: Optional Object (e.g., {ConsentID: "xyz", IPAddress: "1.2.3.4", PolicyVersion: "1.1"})

  // Step 1: Create Audit Log Entry
  LogEntry = CREATE NewLogEntry (
    LogID: GenerateUniqueID(), // Unique ID for the log entry
    Timestamp: CurrentTimestamp(), // Precise timestamp of the event
    EventType: EventType,
    Actor: {
      ID: ActorID,
      Type: DetermineActorType(ActorID) // e.g., "Citizen", "DataConsumer", "SystemGateway"
    },
    Subject: {
      ID: SubjectID,
      Type: DetermineSubjectType(SubjectID) // e.g., "Citizen", "Consent"
    },
    ResourceImpacted: TargetResource,
    Action: ActionDetails,
    Outcome: ExtractOutcomeFromDetails(ActionDetails), // e.g., "Success", "Failure", "Denied", "Granted"
    Context: AdditionalContext OR {}
  )

  // Step 2: Sign the Log Entry (for integrity and non-repudiation)
  // The audit system itself would have its own key for signing.
  LogEntry.Signature = DigitalSignatureService.Sign(LogEntry, AuditSystemPrivateKey)

  // Step 3: Store Log Entry in an Immutable Log Store
  // This could be a distributed ledger, a write-once database, or a cryptographically chained log file.
  ImmutableLogStore.Append(LogEntry)

  // Example Logged Information for Key Events:

  // 1. Consent Grant:
  //   EventType: "ConsentGranted"
  //   ActorID: CitizenDID
  //   SubjectID: ConsentID (newly created)
  //   TargetResource: { ConsumerDID: ..., GrantedDataTypes: [...], Purpose: ..., Expiry: ... }
  //   ActionDetails: "Citizen granted consent for data sharing."
  //   AdditionalContext: { RequestingConsumerDID: ... }

  // 2. Data Access Request (Received by Gateway):
  //   EventType: "DataAccessRequestReceived"
  //   ActorID: ConsumerDID
  //   SubjectID: RequestedCitizenDID
  //   TargetResource: { RequestedDataTypes: [...], RequestedPurpose: ... }
  //   ActionDetails: "Data consumer initiated a request for data access."
  //   AdditionalContext: { GatewayNodeID: ..., SourceIP: ... }

  // 3. Data Access Granted (by Gateway after verification):
  //   EventType: "DataAccessApproved"
  //   ActorID: GatewayID
  //   SubjectID: ConsumerDID (who is granted access)
  //   TargetResource: { CitizenDID: ..., GrantedDataTypes: [...], Purpose: ... }
  //   ActionDetails: "Data access approved based on valid consent."
  //   AdditionalContext: { ConsentID: ..., PolicyVersionUsedForVerification: ... }

  // 4. Data Access Denied (by Gateway):
  //   EventType: "DataAccessDenied"
  //   ActorID: GatewayID
  //   SubjectID: ConsumerDID (who is denied access)
  //   TargetResource: { CitizenDID: ..., RequestedDataTypes: [...], RequestedPurpose: ... }
  //   ActionDetails: "Data access denied. Reason: [e.g., NoMatchingConsent, ConsentExpired, AuthenticationFailed]"
  //   AdditionalContext: { AttemptedConsentID: ... (if any specific one was checked) }

  // 5. Data Retrieval (from PDS by Gateway):
  //   EventType: "DataRetrievedFromPDS"
  //   ActorID: GatewayID
  //   SubjectID: CitizenDID (whose data is being retrieved)
  //   TargetResource: { RetrievedDataTypes: [...], PDS_ID: ... }
  //   ActionDetails: "Gateway retrieved specified data from PDS."
  //   AdditionalContext: { ConsentID: ..., AnonymizationApplied: true/false }

  // 6. Data Sent to Consumer:
  //   EventType: "DataSentToConsumer"
  //   ActorID: GatewayID
  //   SubjectID: ConsumerDID
  //   TargetResource: { CitizenDID: ..., SentDataTypesDescription: ... } // Avoid logging actual data
  //   ActionDetails: "Encrypted data package sent to consumer."
  //   AdditionalContext: { ConsentID: ..., TransmissionProtocol: "TLSv1.3" }

  // 7. Consent Revocation:
  //   EventType: "ConsentRevoked"
  //   ActorID: CitizenDID
  //   SubjectID: ConsentID (being revoked)
  //   TargetResource: { ConsumerDID: ..., OriginallyGrantedData: [...], OriginalPurpose: ... }
  //   ActionDetails: "Citizen revoked previously granted consent."
  //   AdditionalContext: { RevocationTimestamp: ... }

END FUNCTION
---
## 6. Next Steps

The pseudocode outlined above provides a functional blueprint for the core operations of DEC-01. The subsequent project phases will extend these concepts:

*   **DEC-02: Sign and Verify With My Domain:** This phase will introduce pseudocode for functions related to:
    *   Generating digital signatures using a citizen's domain-linked DID.
    *   Constructing verifiable presentations that include these domain-based signatures.
    *   Verifying such signatures, including resolving the domain-linked DID and checking associated policies or attestations.
    *   Integrating these signing and verification steps into existing data sharing or document management workflows.

*   **DEC-03: Domain Name Signature Provider:** This phase will detail pseudocode for the operations of a signature provider service, including:
    *   Endpoints for domain owners to register or link their domains with DIDs.
    *   Processes for issuing VCs or attestations that link a DID to a verified domain.
    *   Mechanisms for managing the lifecycle of these domain-linked credentials.
    *   APIs for relying parties to query or verify the status of domain-linked DIDs or credentials.