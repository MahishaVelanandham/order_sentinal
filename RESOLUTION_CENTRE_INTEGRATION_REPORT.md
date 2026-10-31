# Resolution Centre Integration & Upgrade Report

**Project:** OrderFlow Sentinel – Self-Healing AI for Order & API Failure Resolution  
**Location:** `C:\Users\MAHISHA V\.gemini\antigravity\scratch\orderflow-sentinel\`  
**Date:** 2026-10-31  
**Status:** FULLY INTEGRATED & VERIFIED  

---

## 1. Executive Summary

The **Resolution Centre** has been upgraded from displaying surface-level status responses into a centralized operations control hub. All four remediation actions:
1. **Reject Recommendation**
2. **Direct Retry (Backoff)**
3. **Escalate to Human**
4. **Approve & Self-Heal**

now execute genuine business logic across the Node.js API Gateway, update persistent collections in MongoDB (`healingactions`, `orderevents`, `orders`, `incidentlogs`), broadcast real-time events via Socket.io, and synchronize live telemetry across all connected frontend pages (Overview Dashboard, Order Monitoring, Order Details Journey, Failure Analysis & RCA, and Audit Logs).

---

## 2. Existing Implementation Analysis & Root Causes

Prior to this upgrade, inspection revealed three core synchronization bottlenecks:
* **Order Rejection Misattribution:** Rejecting an AI recommendation previously updated the underlying customer order to `ESCALATED`, confusing recommendation rejection with order rejection.
* **Missing Timeline Events:** Rejection and manual escalation actions recorded entries in `HealingAction` but omitted corresponding `OrderEvent` records in the order's journey timeline.
* **Socket Event Dropping:** The frontend `usePipelineSocket` hook only listened to `order:created` and `order:healed`. Events like `order:escalated`, `remediation:rejected`, and `remediation:approved` were ignored by the client listener, requiring manual browser refreshes.
* **Duplicate Approval Holes:** The approval gate allowed approving actions regardless of prior operator rejections, creating a risk of conflicting recovery workflows.

---

## 3. Implementation of the Four Core Actions

### Action 1: Reject Recommendation
* **Backend Endpoint:** `POST /api/remediation/reject/:actionId`
* **Execution Flow:**
  1. Identifies the `HealingAction` document by `actionId`.
  2. Updates the recommendation document status to `REJECTED`, storing the operator's notes and setting `executionResult.success = false`.
  3. **Order Protection Guardrail:** Does **NOT** cancel, reject, or alter the customer's original `overallStatus` or order journey.
  4. Appends a `STAGE_REJECTED` audit event to `OrderEvent` with HTTP 400 telemetry and operator notes.
  5. Updates the associated `IncidentLog` status to `ESCALATED` for human supervisory tracking.
  6. Emits `remediation:rejected` over Socket.io.
  7. Moves the recommendation out of **Pending Actions** into **Escalations** in the UI.

### Action 2: Direct Retry (Backoff)
* **Backend Endpoint:** `POST /api/remediation/retry/:orderId`
* **Execution Flow:**
  1. Validates that the order is not in a terminal state (`COMPLETED`, `REJECTED`, `ESCALATED`, `CANCELLED`).
  2. Enforces the strict maximum retry limit (`MAX_RETRY_LIMIT = 3`). If exceeded, trips the circuit breaker, escalates to operations, logs an audit record with reason `MAX_RETRY_LIMIT_EXCEEDED`, and returns HTTP 400.
  3. Calculates deterministic exponential backoff delay: `500ms * 2^(attempt - 1)`.
  4. Appends a `STAGE_RETRY` event into `OrderEvent`.
  5. Resumes downstream execution pipeline sequentially from the failed stage to `NOTIFICATION`.
  6. Updates order status to `COMPLETED` and marks `isAutoHealed: true`.
  7. Updates `IncidentLog` to `AUTO_RESOLVED` and marks `HealingAction` as `COMPLETED`.
  8. Emits `order:healed` over Socket.io.

### Action 3: Escalate to Human
* **Backend Endpoint:** `POST /api/remediation/escalate/:orderId`
* **Execution Flow:**
  1. Retrieves the order and transitions its `overallStatus` to `ESCALATED`.
  2. Updates the associated `IncidentLog` to `ESCALATED`.
  3. Creates a new `HealingAction` audit record with `actionType: 'ESCALATE_HUMAN_OPERATOR'`, `riskTier: 'HIGH'`, `status: 'ESCALATED'`, and operator notes.
  4. Appends a `STAGE_DELAYED` event to `OrderEvent` documenting the handoff to Level-2 telecom engineers.
  5. Emits `order:escalated` over Socket.io.
  6. Moves the item immediately from **Pending Actions** into **Escalations** in the Resolution Centre.

### Action 4: Approve & Self-Heal
* **Backend Endpoint:** `POST /api/remediation/approve/:actionId`
* **Execution Flow:**
  1. Validates that the action exists and is in `RECOMMENDED` or `APPROVED` state.
  2. Rejects approval attempts if the action was already `COMPLETED` or `REJECTED` with HTTP 400.
  3. Verifies safety policy: hard business rejections (e.g. unserviceable addresses) cannot be auto-approved.
  4. Updates action status to `APPROVED` and executes `remediationService.executeResolution()`.
  5. If execution succeeds:
     * Appends synthetic recovery event and completes subsequent pipeline stages.
     * Transitions order to `COMPLETED`.
     * Updates `HealingAction` to `COMPLETED` and `IncidentLog` to `AUTO_RESOLVED`.
     * Emits `order:healed` and `remediation:approved`.
  6. If execution fails:
     * Reverts order state safely to its prior status.
     * Records failure summary in `HealingAction` (`status: 'FAILED'`).
     * Emits `order:recovery_failed` without showing false positives.

---

## 4. Multi-Page Synchronization Matrix

| Page | Monitored Fields & Impact | Synchronization Mechanism |
| :--- | :--- | :--- |
| **Resolution Centre** | Pending, Auto-Resolved, and Escalated queue lists, item counts, decision cards | Socket.io (`order:healed`, `order:escalated`, `remediation:rejected`, `remediation:approved`) + `onRefresh()` |
| **Overview Dashboard** | Total orders, completed/failed/delayed/rejected counts, auto-resolved count, SLA risk % | Reactive props re-calculated from refreshed MongoDB orders and incidents |
| **Order Monitoring** | Status badge, stage badge, failure count, search & filter results | Global state auto-refresh via Socket.io |
| **Order Details Journey** | Stage progress bar, chronological event cards, latency telemetry, retry events | Real-time fetch of `/api/orders/:id/timeline` reflecting `STAGE_RETRY`, `STAGE_REJECTED`, and `STAGE_DELAYED` |
| **Failure Analysis & RCA** | Incident status badges (`AUTO_RESOLVED`, `ESCALATED`, `OPEN`), root cause details | Incident collection re-query synced through WebSocket |
| **Predictive Digital Twin** | Read-only simulation sandbox; stays decoupled and unaffected by live healing mutations | Independent What-If query triggered only upon user demand |
| **Audit Logs** | Comprehensive audit trail table showing previous and new status, timestamps, idempotency keys | Real-time query of `/api/remediation/history` |

---

## 5. Verification & Test Evidence

All 72 automated checks in the independent test suite [`backend/audit_suite.js`](file:///C:/Users/MAHISHA%20V/.gemini/antigravity/scratch/orderflow-sentinel/backend/audit_suite.js) executed cleanly with **100% PASS** rate:

```
================================================================
📊 AUDIT SUMMARY:
  Total Checks Executed : 72
  Passed Checks         : 72
  Failed Checks         : 0
  System Health Score   : 100.0%
================================================================
```

### End-to-End Action Verification:
* **Reject Recommendation:** Tested on `ORD-679457-626`. Status remained `FAILED` (order preserved); `STAGE_REJECTED` event logged; audit record created (`status: 'REJECTED'`); approval blocked afterwards with HTTP 400.
* **Direct Retry (Backoff):** Tested on `ORD-974515-373`. Status transitioned `FAILED` &rarr; `COMPLETED`; stages resumed through `NOTIFICATION`; `IncidentLog` transitioned to `AUTO_RESOLVED`.
* **Escalate to Human:** Tested on `ORD-959919-359`. Status transitioned to `ESCALATED`; `STAGE_DELAYED` event recorded; audit action created with `status: 'ESCALATED'`.
* **Approve & Self-Heal:** Tested on `ORD-985157-823`. Resolution executed successfully; order marked `COMPLETED`; duplicate approval attempt blocked with HTTP 400.
* **Safety Guardrails:** Completed order retry blocked with HTTP 400; hard rejection retry blocked with HTTP 400; circuit breaker triggered after 3 retries.

---

## 6. Files Modified

1. [`backend/controllers/remediation.controller.js`](file:///C:/Users/MAHISHA%20V/.gemini/antigravity/scratch/orderflow-sentinel/backend/controllers/remediation.controller.js)
   * Enforced order preservation on recommendation rejection.
   * Added `OrderEvent` logging for rejection and escalation.
   * Added state guard against approving previously rejected actions.
2. [`frontend/src/hooks/usePipelineSocket.js`](file:///C:/Users/MAHISHA%20V/.gemini/antigravity/scratch/orderflow-sentinel/frontend/src/hooks/usePipelineSocket.js)
   * Registered socket listeners for `order:escalated`, `remediation:rejected`, and `remediation:approved`.
3. [`frontend/src/pages/ResolutionCentre.jsx`](file:///C:/Users/MAHISHA%20V/.gemini/antigravity/scratch/orderflow-sentinel/frontend/src/pages/ResolutionCentre.jsx)
   * Aligned action success messaging with backend API responses.
   * Ensured `onRefresh()` triggers parent reload after every mutation.
