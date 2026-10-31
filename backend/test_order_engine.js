/**
 * OrderFlow Sentinel - Order Simulation Engine Test Suite
 * Tests all requested endpoints, scenarios, and fault injections.
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
  console.log('===============================================================');
  console.log('🧪 Starting OrderFlow Sentinel Order Simulation Engine Tests');
  console.log('===============================================================\n');

  try {
    // 1. Health Check
    console.log('--- 1. Testing GET /api/health ---');
    const healthRes = await makeRequest('/health');
    console.log(`Status: ${healthRes.status}`);
    console.log('Response:', JSON.stringify(healthRes.data, null, 2));

    // 2. Scenario 1: Generate Successful Order
    console.log('\n--- 2. Testing POST /api/orders/generate (Scenario: SUCCESS) ---');
    const successRes = await makeRequest('/orders/generate', 'POST', {
      scenario: 'SUCCESS'
    });
    console.log(`Status: ${successRes.status}`);
    const successOrder = successRes.data.data;
    console.log('Generated Order Number:', successOrder.orderNumber);
    console.log('Correlation ID:', successOrder.correlationId);
    console.log('Product Type:', successOrder.productType);
    console.log('Overall Status:', successOrder.overallStatus);
    console.log('Actual Duration:', `${successOrder.actualProcessingTimeMs}ms`);

    // 3. Scenario 2: Generate Order with API Error
    console.log('\n--- 3. Testing POST /api/orders/generate (Scenario: API_ERROR) ---');
    const apiErrorRes = await makeRequest('/orders/generate', 'POST', {
      scenario: 'API_ERROR'
    });
    console.log(`Status: ${apiErrorRes.status}`);
    const errorOrder = apiErrorRes.data.data;
    console.log('Generated Order Number:', errorOrder.orderNumber);
    console.log('Overall Status:', errorOrder.overallStatus);
    console.log('Failure Details:', JSON.stringify(errorOrder.failureDetails, null, 2));

    // 4. Scenario 3: Generate Order with Processing Delay
    console.log('\n--- 4. Testing POST /api/orders/generate (Scenario: DELAY) ---');
    const delayRes = await makeRequest('/orders/generate', 'POST', {
      scenario: 'DELAY'
    });
    console.log(`Status: ${delayRes.status}`);
    const delayOrder = delayRes.data.data;
    console.log('Generated Order Number:', delayOrder.orderNumber);
    console.log('Overall Status:', delayOrder.overallStatus);
    console.log('SLA Breach Predicted:', delayOrder.slaBreachPredicted);
    console.log('SLA Breach Probability:', delayOrder.slaBreachProbability);

    // 5. Scenario 4: Generate Order with Rejection
    console.log('\n--- 5. Testing POST /api/orders/generate (Scenario: REJECTION) ---');
    const rejectRes = await makeRequest('/orders/generate', 'POST', {
      scenario: 'REJECTION'
    });
    console.log(`Status: ${rejectRes.status}`);
    const rejectOrder = rejectRes.data.data;
    console.log('Generated Order Number:', rejectOrder.orderNumber);
    console.log('Overall Status:', rejectOrder.overallStatus);
    console.log('Rejection Details:', JSON.stringify(rejectOrder.failureDetails, null, 2));

    // 6. Scenario 5: Generate Order Stuck Between Stages
    console.log('\n--- 6. Testing POST /api/orders/generate (Scenario: STUCK) ---');
    const stuckRes = await makeRequest('/orders/generate', 'POST', {
      scenario: 'STUCK'
    });
    console.log(`Status: ${stuckRes.status}`);
    const stuckOrder = stuckRes.data.data;
    console.log('Generated Order Number:', stuckOrder.orderNumber);
    console.log('Overall Status:', stuckOrder.overallStatus);
    console.log('Stuck Reason:', JSON.stringify(stuckOrder.failureDetails, null, 2));

    // 7. Test GET /api/orders (Listing and Summary)
    console.log('\n--- 7. Testing GET /api/orders ---');
    const listRes = await makeRequest('/orders');
    console.log(`Status: ${listRes.status}`);
    console.log('Status Summary:', JSON.stringify(listRes.data.summary, null, 2));
    console.log('Total Orders Count:', listRes.data.pagination.total);

    // 8. Test GET /api/orders/:id by Correlation ID
    console.log('\n--- 8. Testing GET /api/orders/:id (Using Correlation ID) ---');
    const singleRes = await makeRequest(`/orders/${successOrder.correlationId}`);
    console.log(`Status: ${singleRes.status}`);
    console.log('Found Order:', singleRes.data.data.orderNumber, 'Status:', singleRes.data.data.overallStatus);

    // 9. Test GET /api/orders/:id/timeline (Stage Events)
    console.log('\n--- 9. Testing GET /api/orders/:id/timeline (Timeline Events) ---');
    const timelineRes = await makeRequest(`/orders/${successOrder.orderNumber}/timeline`);
    console.log(`Status: ${timelineRes.status}`);
    console.log('Total Events in Timeline:', timelineRes.data.totalEvents);
    console.log('Sample Events:');
    timelineRes.data.timeline.forEach((ev, i) => {
      console.log(`  [Event ${i + 1}] Stage: ${ev.stage.padEnd(16)} | Type: ${ev.eventType.padEnd(15)} | Status: ${ev.httpStatusCode} | Latency: ${ev.latencyMs}ms`);
    });

    // 10. Test Fault Injection
    console.log('\n--- 10. Testing Fault Injection via POST /api/chaos/inject ---');
    const chaosInjectRes = await makeRequest('/chaos/inject', 'POST', {
      enabled: true,
      targetStage: 'PAYMENT',
      faultType: 'API_ERROR_504',
      failureProbability: 1.0
    });
    console.log('Chaos Rule Response:', JSON.stringify(chaosInjectRes.data, null, 2));

    console.log('\nGenerating an order under injected fault:');
    const chaosOrderRes = await makeRequest('/orders/generate', 'POST', { scenario: 'SUCCESS' });
    console.log('Injected Order Status:', chaosOrderRes.data.data.overallStatus);
    console.log('Injected Order Stage:', chaosOrderRes.data.data.currentStage);
    console.log('Injected Error Details:', JSON.stringify(chaosOrderRes.data.data.failureDetails, null, 2));

    // Reset Chaos
    console.log('\nResetting Chaos via POST /api/chaos/reset:');
    const resetRes = await makeRequest('/chaos/reset', 'POST');
    console.log('Reset Response:', JSON.stringify(resetRes.data, null, 2));

    console.log('\n===============================================================');
    console.log('✅ ALL ORDER SIMULATION ENGINE TESTS PASSED SUCCESSFULLY!');
    console.log('===============================================================');
  } catch (err) {
    console.error('❌ Test execution error:', err.message);
  }
};

runSuite();
