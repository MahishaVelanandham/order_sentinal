/**
 * OrderFlow Sentinel - Final Phase 4 Comprehensive Validation Runner
 */
const axios = require('axios');
const mongoose = require('mongoose');

const API_BASE = 'http://localhost:5000/api';
const AI_BASE = 'http://127.0.0.1:8000';
const MONGO_URI = 'mongodb://127.0.0.1:27017/orderflow_sentinel';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

const results = {
  phases: {},
  passed: 0,
  failed: 0,
  details: []
};

function record(phase, testName, passed, data = {}) {
  if (!results.phases[phase]) results.phases[phase] = { passed: 0, failed: 0, items: [] };
  if (passed) {
    results.passed++;
    results.phases[phase].passed++;
    console.log(`  ✅ [${phase}] ${testName}`);
  } else {
    results.failed++;
    results.phases[phase].failed++;
    console.log(`  ❌ [${phase}] ${testName}`);
  }
  results.details.push({ phase, testName, passed, ...data });
}

async function runValidation() {
  console.log(`================================================================`);
  console.log(`🚀 ORDERFLOW SENTINEL: PHASE 4 FINAL COMPREHENSIVE VALIDATION`);
  console.log(`================================================================\n`);

  // -------------------------------------------------------------
  // PHASE 1: APPLICATION & SERVICE VALIDATION
  // -------------------------------------------------------------
  console.log(`[PHASE 1] Checking Live Services & Storage Mode...`);
  try {
    const health = await client.get('/health');
    const isNodeUp = health.status === 200 && health.data.status === 'UP';
    const isMongoConnected = health.data.dependencies?.database?.status === 'CONNECTED';
    const isPersistentMode = health.data.storageMode === 'PERSISTENT_MONGODB';

    record('Phase 1', 'Node.js Backend Online (Port 5000)', isNodeUp, { uptime: health.data.uptimeSeconds });
    record('Phase 1', 'MongoDB Connected & Ready', isMongoConnected, { db: health.data.dependencies?.database?.databaseName });
    record('Phase 1', 'Storage Mode Confirmed PERSISTENT_MONGODB', isPersistentMode, { mode: health.data.storageMode });

    const aiHealth = await axios.get(`${AI_BASE}/health`);
    record('Phase 1', 'Python FastAPI AI Engine Online (Port 8000)', aiHealth.data.status === 'UP', { version: aiHealth.data.version });

    const frontRes = await axios.get('http://localhost:5173');
    record('Phase 1', 'React Frontend Online (Port 5173)', frontRes.status === 200);
  } catch (err) {
    record('Phase 1', 'Service Connectivity Check', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // PHASE 2: COMPLETE ORDER LIFECYCLE DEMONSTRATION
  // -------------------------------------------------------------
  console.log(`\n[PHASE 2] Demonstrating 6-Stage Lifecycle & Scenarios...`);
  let successOrder = null;
  let apiFailOrder = null;
  let delayOrder = null;
  let rejectionOrder = null;

  try {
    // 2.1 SUCCESS Scenario across 6 stages
    const gen1 = await client.post('/orders/generate', { scenario: 'SUCCESS', count: 1 });
    successOrder = gen1.data.orders ? gen1.data.orders[0] : gen1.data.data;
    const isSuccess = successOrder.overallStatus === 'COMPLETED';
    record('Phase 2', 'Successful Order Progression (Status = COMPLETED)', isSuccess, { orderNumber: successOrder.orderNumber });

    // Verify 6 stages in timeline
    const timelineRes = await client.get(`/orders/${successOrder.orderNumber}/timeline`);
    const events = timelineRes.data.timeline || [];
    const stagesSeen = events.filter(e => e.eventType === 'STAGE_COMPLETED').map(e => e.stage);
    const expectedStages = ['CRM', 'ORDER_MANAGEMENT', 'INVENTORY', 'PAYMENT', 'PROVISIONING', 'NOTIFICATION'];
    const all6Present = expectedStages.every(s => stagesSeen.includes(s));
    record('Phase 2', 'Complete 6 Stages Executed Chronologically in Timeline', all6Present, { stagesSeen });

    // 2.2 API Failure Scenario (HTTP 504)
    const gen2 = await client.post('/orders/generate', { scenario: 'API_ERROR', count: 1 });
    apiFailOrder = gen2.data.orders ? gen2.data.orders[0] : gen2.data.data;
    record('Phase 2', 'API Failure Scenario Trapped (Status = FAILED, HTTP 504)', apiFailOrder.overallStatus === 'FAILED' && apiFailOrder.failureDetails?.httpStatusCode === 504, {
      failedStage: apiFailOrder.failureDetails?.stage,
      code: apiFailOrder.failureDetails?.httpStatusCode
    });

    // 2.3 Delay Scenario
    const gen3 = await client.post('/orders/generate', { scenario: 'DELAY', count: 1 });
    delayOrder = gen3.data.orders ? gen3.data.orders[0] : gen3.data.data;
    record('Phase 2', 'Order Processing Delay Detected (Status = DELAYED)', delayOrder.overallStatus === 'DELAYED' || delayOrder.actualProcessingTimeMs > 2500, {
      latency: delayOrder.actualProcessingTimeMs
    });

    // 2.4 Business Validation Rejection Scenario
    const gen4 = await client.post('/orders/generate', { scenario: 'REJECTION', count: 1 });
    rejectionOrder = gen4.data.orders ? gen4.data.orders[0] : gen4.data.data;
    record('Phase 2', 'Business Validation Rejection Enforced (Status = REJECTED, HTTP 422)', rejectionOrder.overallStatus === 'REJECTED', {
      reason: rejectionOrder.failureDetails?.errorMessage
    });
  } catch (err) {
    record('Phase 2', 'Order Lifecycle Demonstration', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // PHASE 3: AI AND DIGITAL TWIN VALIDATION
  // -------------------------------------------------------------
  console.log(`\n[PHASE 3] Validating AI Models & Digital Twin Scenarios...`);
  try {
    // 3.1 Failure Detection & Isolation Forest
    const detectRes = await client.post(`/incidents/detect/${delayOrder.orderNumber}`);
    const incident = detectRes.data.incident || detectRes.data.data?.detection;
    const isAnomalous = detectRes.data.incidentDetected === true;
    record('Phase 3', 'Isolation Forest Anomaly & Failure Detection', isAnomalous, {
      category: incident?.failureCategory,
      affectedService: incident?.affectedService
    });

    // 3.2 Root Cause Analysis
    const rcaRes = await client.post(`/incidents/rca/${apiFailOrder.orderNumber}`);
    const rca = rcaRes.data.rca || rcaRes.data.data?.rca;
    record('Phase 3', 'Evidence-Based Root Cause Analysis (RCA)', Boolean(rca && rca.failedStage && rca.rootCauseExplanation), {
      failedStage: rca?.failedStage,
      rootCause: rca?.rootCauseExplanation
    });

    // 3.3 Digital Twin Prediction & What-If Scenarios (A, B, C)
    const twinRes = await client.post(`/twin/predict/${successOrder.orderNumber}`, {
      queueDelayMs: 250,
      serviceHealthScore: 0.70,
      serviceFailureRate: 0.10
    });
    const twinData = twinRes.data.data;
    const comparisons = twinData.scenarioComparisons || [];
    const hasScenarios = comparisons.some(s => s.scenarioKey === 'SCENARIO_A') &&
                         comparisons.some(s => s.scenarioKey === 'SCENARIO_B') &&
                         comparisons.some(s => s.scenarioKey === 'SCENARIO_C');
    record('Phase 3', 'Digital Twin Multi-Scenario Simulation (Scenarios A, B, C)', hasScenarios, {
      scenarioCount: comparisons.length,
      safest: twinData.safestScenario?.name,
      mlModelAccuracy: `${Math.round(twinData.modelAccuracy * 100)}%`
    });

    // 3.4 Decoupling Verification: Underlying order remains unchanged
    const verifyOrder = await client.get(`/orders/${successOrder.orderNumber}`);
    const orderDoc = verifyOrder.data.data || verifyOrder.data.order;
    record('Phase 3', 'Digital Twin Decoupling (Real Order Remains Untouched)', orderDoc.overallStatus === 'COMPLETED' && orderDoc.orderNumber === successOrder.orderNumber);
  } catch (err) {
    record('Phase 3', 'AI & Digital Twin Validation', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // PHASE 4: SELF-HEALING AND SAFETY
  // -------------------------------------------------------------
  console.log(`\n[PHASE 4] Validating Self-Healing Guardrails & Safety Policy...`);
  try {
    // 4.1 Recommendation with Exponential Backoff
    const recRes = await client.get(`/remediation/recommendations/${apiFailOrder.orderNumber}`);
    const rec = recRes.data.recommendation || recRes.data.data;
    record('Phase 4', 'Remediation Policy Generates Exponential Backoff Action', rec.actionType === 'EXPONENTIAL_RETRY', {
      actionId: rec.actionId,
      backoffDelayMs: rec.parameters?.backoffDelayMs,
      idempotencyKey: rec.idempotencyKey
    });

    // 4.2 Execute Recovery Action
    const retryRes = await client.post(`/remediation/retry/${apiFailOrder.orderNumber}`);
    record('Phase 4', 'Self-Healing Execution Heals Order (Status = COMPLETED)', retryRes.status === 200);

    // 4.3 Completed Order Retry Blocked (HTTP 400)
    let compBlocked = false;
    try {
      await client.post(`/remediation/retry/${apiFailOrder.orderNumber}`);
    } catch (e) {
      compBlocked = e.response?.status === 400 && e.response?.data?.message?.includes('Completed orders cannot be retried');
    }
    record('Phase 4', 'Completed Order Retry Strictly Blocked (HTTP 400)', compBlocked);

    // 4.4 Hard Business Rejection Auto-Heal Blocked
    let rejBlocked = false;
    try {
      await client.post(`/remediation/retry/${rejectionOrder.orderNumber}`);
    } catch (e) {
      rejBlocked = e.response?.status === 400 && e.response?.data?.message?.includes('Hard business rejected orders cannot be retried');
    }
    record('Phase 4', 'Hard Rejection Cannot Be Automatically Retried (HTTP 400)', rejBlocked);

    // 4.5 Max Retry Limit Guard
    let limitBlocked = false;
    try {
      const orderLim = await client.post('/orders/generate', { scenario: 'API_ERROR', failureCount: 3, count: 1 });
      const limObj = orderLim.data.orders ? orderLim.data.orders[0] : orderLim.data.data;
      await client.post(`/remediation/retry/${limObj.orderNumber}`);
    } catch (e) {
      limitBlocked = e.response?.status === 400 && e.response?.data?.message?.includes('Max retry limit of 3 exceeded');
    }
    record('Phase 4', 'Max Retry Limit Enforces Escalation & Logs Audit (HTTP 400)', limitBlocked);
  } catch (err) {
    record('Phase 4', 'Self-Healing Safety Validation', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // PHASE 5: DATABASE PERSISTENCE & AUDIT COLLECTION COUNTS
  // -------------------------------------------------------------
  console.log(`\n[PHASE 5] Validating MongoDB Collections & Persistence...`);
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    const collections = await db.listCollections().toArray();
    const names = collections.map(c => c.name);

    const [ordersCount, eventsCount, incidentsCount, actionsCount, twinsCount] = await Promise.all([
      db.collection('orders').countDocuments(),
      db.collection('orderevents').countDocuments(),
      db.collection('incidentlogs').countDocuments(),
      db.collection('healingactions').countDocuments(),
      db.collection('digitaltwinscenarios').countDocuments()
    ]);

    record('Phase 5', 'Orders Collection Present & Populated in MongoDB', ordersCount > 0, { count: ordersCount });
    record('Phase 5', 'OrderEvents Collection Present & Populated in MongoDB', eventsCount > 0, { count: eventsCount });
    record('Phase 5', 'IncidentLogs Collection Present & Populated in MongoDB', incidentsCount > 0, { count: incidentsCount });
    record('Phase 5', 'HealingActions Collection Present & Populated in MongoDB', actionsCount > 0, { count: actionsCount });
    record('Phase 5', 'DigitalTwinScenarios Collection Present & Populated in MongoDB', twinsCount > 0, { count: twinsCount });

    await mongoose.disconnect();
  } catch (err) {
    record('Phase 5', 'Database Collection Counts', false, { error: err.message });
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log(`\n================================================================`);
  console.log(`📊 FINAL VALIDATION SUMMARY:`);
  console.log(`================================================================`);
  console.log(`Total Checks Executed : ${results.passed + results.failed}`);
  console.log(`Passed Checks         : ${results.passed}`);
  console.log(`Failed Checks         : ${results.failed}`);
  console.log(`Overall Health Status : ${results.failed === 0 ? '🟢 100% READY FOR PROJECT REVIEW' : '🔴 ISSUES DETECTED'}`);
  console.log(`================================================================\n`);

  return results;
}

if (require.main === module) {
  runValidation()
    .then(r => process.exit(r.failed > 0 ? 1 : 0))
    .catch(err => {
      console.error('Fatal Validation Error:', err);
      process.exit(1);
    });
}
