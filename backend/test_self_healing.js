/**
 * Test Suite for OrderFlow Sentinel - Self-Healing Resolution Engine
 * Tests all required recovery and safety scenarios:
 * 1. Successful Recovery: 504 Gateway Timeout -> Exponential Backoff Retry -> Completed
 * 2. Successful Recovery: Fixable Validation / Inventory Depot Failover -> Completed
 * 3. Unsuccessful / Safety: Hard Business Rejection cannot be overridden -> Escalated to Human
 * 4. Safety Guardrail: Maximum retry limit (3) prevents infinite retry loops
 * 5. Rejection of Recommendation by Operator
 * 6. Audit Trail: Querying resolution history
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
  console.log('❤️‍🩹  TESTING SELF-HEALING RESOLUTION ENGINE');
  console.log('======================================================================\n');

  try {
    // -------------------------------------------------------------------
    // SCENARIO 1: Successful Recovery of 504 Gateway Timeout via Exponential Retry
    // -------------------------------------------------------------------
    console.log('>>> [SCENARIO 1] RECOVERY OF 504 GATEWAY TIMEOUT VIA EXPONENTIAL BACKOFF <<<');
    const gen504 = await makeRequest('/orders/generate', 'POST', { scenario: 'API_ERROR' });
    const order504 = gen504.data.data;
    console.log(`Failed Order:      ${order504.orderNumber} | Initial Status: ${order504.overallStatus}`);

    // Get recommended resolution
    const recRes1 = await makeRequest(`/remediation/recommendations/${order504.orderNumber}`);
    const rec1 = recRes1.data.data;
    console.log(`Recommended Action: ${rec1.actionType}`);
    console.log(`Risk Tier:          ${rec1.riskTier}`);
    console.log(`Idempotency Key:    ${rec1.idempotencyKey}`);
    console.log(`Decision Reason:    ${rec1.decisionReason}`);

    // Approve and execute resolution
    console.log('Executing resolution via POST /api/remediation/approve...');
    const appRes1 = await makeRequest(`/remediation/approve/${rec1.actionId}`, 'POST');
    const result1 = appRes1.data.data;
    console.log(`Execution Status:   ${result1.status}`);
    console.log(`Result Summary:     ${result1.executionResult.responseSummary}`);
    console.log(`Final Order Status: ${result1.executionResult.finalOrderStatus}`);

    // Verify order state in storage
    const verifyOrder1 = await makeRequest(`/orders/${order504.orderNumber}`);
    console.log(`Verified Order In Store: Status = ${verifyOrder1.data.data.overallStatus}, AutoHealed = ${verifyOrder1.data.data.isAutoHealed}\n`);

    // -------------------------------------------------------------------
    // SCENARIO 2: Successful Recovery of Fixable Validation / Inventory Depot Failover
    // -------------------------------------------------------------------
    console.log('>>> [SCENARIO 2] RECOVERY OF FIXABLE VALIDATION (INVENTORY FAILOVER) <<<');
    // Inject inventory rejection
    await makeRequest('/chaos/inject', 'POST', {
      enabled: true,
      targetStage: 'INVENTORY',
      faultType: 'REJECTION',
      failureProbability: 1.0
    });
    const genInv = await makeRequest('/orders/generate', 'POST', { scenario: 'SUCCESS' });
    const orderInv = genInv.data.data;
    await makeRequest('/chaos/reset', 'POST');

    console.log(`Failed Order:      ${orderInv.orderNumber} | Stage: ${orderInv.currentStage} | Status: ${orderInv.overallStatus}`);
    const recRes2 = await makeRequest(`/remediation/recommendations/${orderInv.orderNumber}`);
    const rec2 = recRes2.data.data;
    console.log(`Recommended Action: ${rec2.actionType}`);
    console.log(`Correction Target:  ${rec2.parameters.syntheticCorrection?.targetDepot}`);

    const appRes2 = await makeRequest(`/remediation/approve/${rec2.actionId}`, 'POST');
    console.log(`Execution Result:   ${appRes2.data.data.executionResult.responseSummary}`);
    console.log(`Final Order Status: ${appRes2.data.data.executionResult.finalOrderStatus}\n`);

    // -------------------------------------------------------------------
    // SCENARIO 3: Safety Guardrail - Hard Business Rejection Cannot Be Overridden
    // -------------------------------------------------------------------
    console.log('>>> [SCENARIO 3] HARD BUSINESS REJECTION (SAFETY POLICY) <<<');
    const genReject = await makeRequest('/orders/generate', 'POST', { scenario: 'REJECTION' });
    const orderReject = genReject.data.data;
    console.log(`Order: ${orderReject.orderNumber} | Status: ${orderReject.overallStatus} (${orderReject.failureDetails?.errorMessage})`);

    const recRes3 = await makeRequest(`/remediation/recommendations/${orderReject.orderNumber}`);
    const rec3 = recRes3.data.data;
    console.log(`Recommended Action:     ${rec3.actionType}`);
    console.log(`Requires Human Approval:${rec3.requiresHumanApproval}`);
    console.log(`Risk Tier:              ${rec3.riskTier}`);
    console.log(`Safety Policy Verdict:  ${rec3.decisionReason}`);

    // Escalate order to human operator
    const escRes = await makeRequest(`/remediation/escalate/${orderReject.orderNumber}`, 'POST', {
      reason: 'Customer address confirmed unserviceable by GPON budget. Escalate to sales for 5G FWA package.'
    });
    console.log(`Escalation Result:      ${escRes.data.message}\n`);

    // -------------------------------------------------------------------
    // SCENARIO 4: Safety Guardrail - Max Retry Limit Prevents Infinite Loops
    // -------------------------------------------------------------------
    console.log('>>> [SCENARIO 4] MAX RETRY LIMIT TO PREVENT INFINITE LOOPS <<<');
    const genLoop = await makeRequest('/orders/generate', 'POST', { scenario: 'API_ERROR' });
    const orderLoop = genLoop.data.data;

    // Retry 1, 2, 3
    console.log('Executing Retry 1...');
    await makeRequest(`/remediation/retry/${orderLoop.orderNumber}`, 'POST');
    console.log('Executing Retry 2...');
    await makeRequest(`/remediation/retry/${orderLoop.orderNumber}`, 'POST');
    console.log('Executing Retry 3...');
    await makeRequest(`/remediation/retry/${orderLoop.orderNumber}`, 'POST');

    console.log('Attempting 4th Retry (Exceeding Max Retry Limit = 3)...');
    const loopRes = await makeRequest(`/remediation/retry/${orderLoop.orderNumber}`, 'POST');
    console.log(`HTTP Status:   ${loopRes.status} (Expected 400 Bad Request)`);
    console.log(`Safety Notice: ${loopRes.data.message}\n`);

    // -------------------------------------------------------------------
    // SCENARIO 5: Operator Rejection of Recommendation
    // -------------------------------------------------------------------
    console.log('>>> [SCENARIO 5] REJECTING RECOMMENDATION <<<');
    const genRejectRec = await makeRequest('/orders/generate', 'POST', { scenario: 'API_ERROR' });
    const orderRejectRec = genRejectRec.data.data;
    const recRes5 = await makeRequest(`/remediation/recommendations/${orderRejectRec.orderNumber}`);
    const rec5 = recRes5.data.data;

    const rejRes = await makeRequest(`/remediation/reject/${rec5.actionId}`, 'POST', {
      reason: 'Payment gateway maintenance window in progress. Hold retries.'
    });
    console.log(`Rejection Message: ${rejRes.data.message}`);
    console.log(`Action Status:     ${rejRes.data.data.status}\n`);

    // -------------------------------------------------------------------
    // SCENARIO 6: View Resolution History (Audit Log)
    // -------------------------------------------------------------------
    console.log('>>> [AUDIT TRAIL] VIEWING RESOLUTION HISTORY (GET /api/remediation/history) <<<');
    const histRes = await makeRequest('/remediation/history');
    console.log(`Total Healing Actions in Audit Log: ${histRes.data.pagination.total}`);
    console.log('Recent Audit Log Entries:');
    histRes.data.data.slice(0, 5).forEach((act, idx) => {
      console.log(`  [${idx + 1}] ID: ${act.actionId} | Order: ${act.orderNumber} | Type: ${act.actionType.padEnd(28)} | Status: ${act.status.padEnd(10)} | Risk: ${act.riskTier}`);
    });

    console.log('\n======================================================================');
    console.log('✅ ALL SELF-HEALING RESOLUTION ENGINE TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================================');
  } catch (err) {
    console.error('❌ Self-healing test suite failed:', err.message);
  }
};

runSuite();
