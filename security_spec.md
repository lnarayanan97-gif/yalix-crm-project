# YALIX CRM Security Specification & Threat Model

## 1. Data Invariants
- Private CRM boundary: Unauthenticated requests are strictly denied (`allow read, write: if false` fallback).
- User verification: Only authenticated, authorized YALIX personnel can read or mutate CRM data.
- Super admin bootstrap: `lnarayanan97@gmail.com` is configured as the bootstrap super administrator.
- Identity and audit integrity: Users cannot forge `createdBy`, `performedBy`, or modify another user's identity fields.
- Immutability of timestamps and IDs: Document primary keys (`companyId`, `contactId`, etc.) and `createdAt` timestamps cannot be mutated after creation.
- Strict schema validation: Inbound payloads must adhere to bounded field sizes, regex patterns for IDs, and allowed status enums.
- Anti-tampering in Audit Logs: Audit log records are append-only; update and delete operations are forbidden.
- Zero client-side role escalation: Non-admin users cannot alter their own `role` in `/users/{userId}`.

## 2. The "Dirty Dozen" Threat Payloads

1. **Unauthenticated Public Read on Companies**: An anonymous actor attempts `get /companies/comp-101`. Expected: PERMISSION_DENIED.
2. **Unauthenticated Write to Contacts**: An anonymous actor attempts `set /contacts/contact-999`. Expected: PERMISSION_DENIED.
3. **Role Escalation Attempt**: A standard member attempts to update `role: "admin"` in `/users/{myUid}`. Expected: PERMISSION_DENIED.
4. **Forged PerformedBy in AuditLog**: User `uid_alice` creates an audit log with `performedBy: "uid_bob"`. Expected: PERMISSION_DENIED.
5. **ID Poisoning Attack**: An attacker supplies a 2048-byte string or illegal characters for `companyId`. Expected: PERMISSION_DENIED.
6. **Denial-of-Wallet Payload**: An attacker attempts to write a 1MB string into `notes` or `companyName`. Expected: PERMISSION_DENIED.
7. **Audit Log Deletion**: An authenticated user attempts to delete an entry from `/audit_logs/log-123`. Expected: PERMISSION_DENIED.
8. **Invalid Enum in Lead Status**: An attacker attempts to create a lead with `leadStatus: "UNKNOWN_EXPLOIT"`. Expected: PERMISSION_DENIED.
9. **Tampering with Immutable CreatedAt**: An attacker attempts to change the original `createdAt` of a company record. Expected: PERMISSION_DENIED.
10. **Ghost Field Injection (Shadow Update)**: An update to a company with unauthorized ghost field `isSuperAdminOverride: true`. Expected: PERMISSION_DENIED.
11. **Client Delegation Bypass (Listing without Auth)**: Unauthorized list query on `/contacts`. Expected: PERMISSION_DENIED.
12. **Negative / NaN Numerical Counts**: An import record with negative counts `rowCount: -500`. Expected: PERMISSION_DENIED.

## 3. Test Runner Definition
All 12 attacks are enforced at the Firestore Security Rules level with strict predicate checks, type safety, size constraints, and role validation.
