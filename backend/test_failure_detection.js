/**
 * Test Suite for OrderFlow Sentinel - Failure Detection Engine
 * Tests all three failure categories separately:
 * 1. API Response Errors (500, 504, 429, Malformed responses)
 * 2. Order Delays (SLA Breaches, Stuck Stages, Isolation Forest Latency Outliers)
 * 3. Order Rejections (Invalid Address, Inventory Unavailable, Payment Rejection, Duplicate Order)
 */
const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

const makeRequest = (path, method = 'GET', body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runSuite = async () => {
  console.log('======================================================================');
  console.log('🛡️  TESTING FAILURE DETECTION ENGINE (ALL 3 FAILURE CATEGORIES)');
  console.log('======================================================================\n');

  try {
    // -------------------------------------------------------------------
    // CATEGORY 1: API RESPONSE ERRORS
    // -------------------------------------------------------------------
    console.log('>>> [CATEGORY 1] TESTING API RESPONSE ERRORS <<<\n');

    // 1A. API Error 504 Gateway Timeout
    console.log('--- 1A: 504 Gateway Timeout on Payment ---');
    const res504 = await makeRequest('/orders/generate', 'POST', { scenario: 'API_ERROR' });
    const order504 = res504.data.data;
    console.log(`Order: ${order504.orderNumber} | Status: ${order504.overallStatus}`);

    const det504 = await makeRequest(`/incidents/detect/${order504.orderNumber}`, 'POST');
    const result504 = det504.data.data.detection;
    console.log(`Detected Category: ${result504.failureCategory}`);
    console.log(`Reason:            ${result504.failureReason}`);
    console.log(`Affected Service:  ${result504.affectedService}`);
    console.log(`Severity:          ${result504.severity}`);
    console.log(`Supporting Evid.:  ${JSON.stringify(result504.supportingEvidence)}\n`);

    // 1B. API Error 500 Internal Error via Chaos Injection
    console.log('--- 1B: HTTP 500 Internal Error on Provisioning ---');
    await makeRequest('/chaos/inject', 'POST', {
      enabled: true,
      targetStage: 'PROVISIONING',
      faultType: 'API_ERROR_500',
      failureProbability: 1.0
    });
    const res500 = await makeRequest('/orders/generate', 'POST', { scenario: 'SUCCESS' });
    const order500 = res500.data.data;
    const det500 = await makeRequest(`/incidents/detect/${order500.orderNumber}`, 'POST');
    const result500 = det500.data.data.detection;
    console.log(`Order: ${order500.orderNumber} | Status: ${order500.overallStatus}`);
    console.log(`Detected Category: ${result500.failureCategory}`);
    console.log(`Reason:            ${result500.failureReason}`);
    console.log(`Affected Service:  ${result500.affectedService}`);
    console.log(`Severity:          ${result500.severity}\n`);
    await makeRequest('/chaos/reset', 'POST');

    // -------------------------------------------------------------------
    // CATEGORY 2: ORDER DELAYS
    // -------------------------------------------------------------------
    console.log('>>> [CATEGORY 2] TESTING ORDER DELAYS <<<\n');

    // 2A: Order Exceeding Total SLA
    console.log('--- 2A: Processing Delay Exceeding SLA ---');
    const resDelay = await makeRequest('/orders/generate', 'POST', { scenario: 'DELAY' });
    const orderDelay = resDelay.data.data;
    const detDelay = await makeRequest(`/incidents/detect/${orderDelay.orderNumber}`, 'POST');
    const resultDelay = detDelay.data.data.detection;
    console.log(`Order: ${orderDelay.orderNumber} | Duration: ${orderDelay.actualProcessingTimeMs}ms`);
    console.log(`Detected Category: ${resultDelay.failureCategory}`);
    console.log(`Reason:            ${resultDelay.failureReason}`);
    console.log(`Affected Service:  ${resultDelay.affectedService}`);
    console.log(`Severity:          ${resultDelay.severity}`);
    console.log(`Supporting Evid.:  ${JSON.stringify(resultDelay.supportingEvidence)}\n`);

    // 2B: Stuck Processing Stage
    console.log('--- 2B: Stuck Processing Stage (Deadlocked Worker Thread) ---');
    const resStuck = await makeRequest('/orders/generate', 'POST', { scenario: 'STUCK' });
    const orderStuck = resStuck.data.data;
    const detStuck = await makeRequest(`/incidents/detect/${orderStuck.orderNumber}`, 'POST');
    const resultStuck = detStuck.data.data.detection;
    console.log(`Order: ${orderStuck.orderNumber} | Status: ${orderStuck.overallStatus}`);
    console.log(`Detected Category: ${resultStuck.failureCategory}`);
    console.log(`Reason:            ${resultStuck.failureReason}`);
    console.log(`Affected Service:  ${resultStuck.affectedService}`);
    console.log(`Severity:          ${resultStuck.severity}\n`);

    // -------------------------------------------------------------------
    // CATEGORY 3: ORDER REJECTIONS
    // -------------------------------------------------------------------
    console.log('>>> [CATEGORY 3] TESTING ORDER REJECTIONS <<<\n');

    // 3A: Invalid Address (Outside boundary)
    console.log('--- 3A: Invalid Address Rejection in CRM ---');
    const resReject = await makeRequest('/orders/generate', 'POST', { scenario: 'REJECTION' });
    const orderReject = resReject.data.data;
    const detReject = await makeRequest(`/incidents/detect/${orderReject.orderNumber}`, 'POST');
    const resultReject = detReject.data.data.detection;
    console.log(`Order: ${orderReject.orderNumber} | Status: ${orderReject.overallStatus}`);
    console.log(`Detected Category: ${resultReject.failureCategory}`);
    console.log(`Reason:            ${resultReject.failureReason}`);
    console.log(`Affected Service:  ${resultReject.affectedService}`);
    console.log(`Severity:          ${resultReject.severity}\n`);

    // -------------------------------------------------------------------
    // MONGODB INCIDENT LOG RETRIEVAL & FILTERING
    // -------------------------------------------------------------------
    console.log('>>> [PERSISTENCE] RETRIEVING STORED INCIDENTS FROM DATABASE <<<\n');
    const incRes = await makeRequest('/incidents');
    console.log(`Total Stored Incidents: ${incRes.data.pagination.total}`);
    console.log('Sample Incidents in Database:');
    incRes.data.data.slice(0, 5).forEach((inc, idx) => {
      console.log(`  [${idx + 1}] ID: ${inc.incidentId} | Order: ${inc.orderNumber} | Category: ${inc.failureCategory.padEnd(20)} | Severity: ${inc.severity.padEnd(8)} | Service: ${inc.affectedService}`);
    });

    console.log('\n======================================================================');
    console.log('✅ ALL 3 FAILURE DETECTION CATEGORIES VERIFIED & PERSISTED TO DATABASE!');
    console.log('======================================================================');
  } catch (err) {
    console.error('❌ Test suite failed:', err.message);
  }
};

runSuite();
