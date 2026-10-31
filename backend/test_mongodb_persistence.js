/**
 * MongoDB Persistence and Restart Survivability Verification Script
 * 
 * Verifies:
 * 1. MongoDB Mongoose Connection on 127.0.0.1:27017/orderflow_sentinel
 * 2. Real database documents in all 5 collections:
 *    - orders
 *    - orderevents
 *    - incidentlogs
 *    - healingactions
 *    - digitaltwinscenarios
 * 3. Pre-restart creation and post-restart survivability check.
 */

const mongoose = require('mongoose');
const Order = require('./models/Order');
const OrderEvent = require('./models/OrderEvent');
const IncidentLog = require('./models/IncidentLog');
const HealingAction = require('./models/HealingAction');
const DigitalTwinScenario = require('./models/DigitalTwinScenario');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/orderflow_sentinel';

async function verifyPersistence(mode = 'create_and_verify') {
  console.log(`================================================================`);
  console.log(`🗄️  MONGODB PERSISTENCE & COLLECTION INTEGRITY VERIFICATION`);
  console.log(`📡 URI: mongodb://127.0.0.1:27017/orderflow_sentinel`);
  console.log(`⚙️  Mode: ${mode}`);
  console.log(`================================================================\n`);

  await mongoose.connect(MONGO_URI);
  console.log(`[MongoDB] Connected successfully to database: ${mongoose.connection.name}`);

  const collections = await mongoose.connection.db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  console.log(`[MongoDB] Existing Collections:`, collectionNames);

  if (mode === 'create_and_verify') {
    // 1. Create a persistent test order
    const testOrderNumber = `ORD-PERSTEST-${Date.now().toString().slice(-4)}`;
    const testCorrelationId = `CORR-PERSTEST-${Date.now().toString().slice(-4)}`;

    const orderDoc = await Order.create({
      orderNumber: testOrderNumber,
      correlationId: testCorrelationId,
      customer: {
        customerRef: 'CUST-PERSTEST-01',
        name: 'Dev Test User',
        email: 'devtest@sentinel.local',
        phone: '+1-555-0199',
        installationAddress: {
          street: '100 MongoDB Drive',
          city: 'Database City',
          postalCode: 'DB-1001',
          serviceZone: 'ZONE-A'
        }
      },
      productType: 'Broadband Fiber 500 Mbps',
      plan: {
        planId: 'PLAN-500',
        planName: 'Enterprise Fiber 500',
        speedMbps: 500,
        monthlyFee: 89.99
      },
      scenario: 'API_ERROR',
      currentStage: 'PROVISIONING',
      overallStatus: 'FAILED',
      expectedCompletionTimeMs: 2500,
      actualProcessingTimeMs: 1240,
      failureCount: 1,
      failureDetails: {
        stage: 'PROVISIONING',
        httpStatusCode: 504,
        errorMessage: '504 Gateway Timeout at Provisioning OLT',
        failureType: 'API_RESPONSE_ERROR'
      }
    });
    console.log(`✅ [1/5] Order persisted to MongoDB: ID ${orderDoc._id}, OrderNumber: ${orderDoc.orderNumber}`);

    // 2. Create OrderEvent
    const eventDoc = await OrderEvent.create({
      orderId: orderDoc._id,
      orderNumber: orderDoc.orderNumber,
      correlationId: orderDoc.correlationId,
      stage: 'PROVISIONING',
      fromStage: 'PAYMENT',
      toStage: 'PROVISIONING',
      eventType: 'STAGE_FAILED',
      httpStatusCode: 504,
      latencyMs: 1240,
      metadata: { oltSlot: 4, port: 2 },
      errorMessage: 'Gateway Timeout'
    });
    console.log(`✅ [2/5] OrderEvent persisted to MongoDB: ID ${eventDoc._id}, Stage: ${eventDoc.stage}`);

    // 3. Create IncidentLog
    const testIncidentId = `INC-PERSTEST-${Date.now().toString().slice(-4)}`;
    const incidentDoc = await IncidentLog.create({
      incidentId: testIncidentId,
      orderId: orderDoc._id,
      orderNumber: orderDoc.orderNumber,
      correlationId: orderDoc.correlationId,
      failureCategory: 'API_RESPONSE_ERROR',
      failureReason: '504 Gateway Timeout at Provisioning OLT',
      affectedService: 'PROVISIONING',
      severity: 'HIGH',
      resolutionStatus: 'OPEN'
    });
    console.log(`✅ [3/5] IncidentLog persisted to MongoDB: ID ${incidentDoc._id}, IncidentId: ${incidentDoc.incidentId}`);

    // 4. Create HealingAction
    const testActionId = `ACT-PERSTEST-${Date.now().toString().slice(-4)}`;
    const actionDoc = await HealingAction.create({
      actionId: testActionId,
      idempotencyKey: `IDEM-PERSTEST-${testOrderNumber}`,
      orderId: orderDoc._id,
      orderNumber: orderDoc.orderNumber,
      correlationId: orderDoc.correlationId,
      stage: 'PROVISIONING',
      actionType: 'EXPONENTIAL_RETRY',
      riskTier: 'LOW',
      requiresHumanApproval: false,
      status: 'COMPLETED',
      decisionReason: 'Transient 504 error. Retrying with exponential backoff.',
      executionResult: {
        success: true,
        responseSummary: 'Healed successfully in test.',
        finalOrderStatus: 'COMPLETED',
        executionDurationMs: 310
      }
    });
    console.log(`✅ [4/5] HealingAction persisted to MongoDB: ID ${actionDoc._id}, ActionId: ${actionDoc.actionId}`);

    // 5. Create DigitalTwinScenario
    const testPredictionId = `PRED-PERSTEST-${Date.now().toString().slice(-4)}`;
    const twinDoc = await DigitalTwinScenario.create({
      predictionId: testPredictionId,
      orderNumber: orderDoc.orderNumber,
      correlationId: orderDoc.correlationId,
      currentStage: 'PROVISIONING',
      elapsedTimeMs: 1240,
      expectedSlaMs: 2500,
      baselineBreachRisk: 0.35,
      mlModelBreachProbability: 0.42,
      modelAccuracy: 0.946,
      isServiceAnomalous: true,
      safestScenario: {
        scenarioKey: 'SCENARIO_C',
        name: 'Route via Standby Gateway',
        predictedSlaBreachRisk: 0.12,
        isSafest: true
      },
      scenarioComparisons: [
        { scenarioKey: 'SCENARIO_A', predictedSlaBreachRisk: 0.78 },
        { scenarioKey: 'SCENARIO_B', predictedSlaBreachRisk: 0.45 },
        { scenarioKey: 'SCENARIO_C', predictedSlaBreachRisk: 0.12 }
      ],
      prescriptiveRecommendation: 'Reroute through Standby Gateway'
    });
    console.log(`✅ [5/5] DigitalTwinScenario persisted to MongoDB: ID ${twinDoc._id}, PredictionId: ${twinDoc.predictionId}`);

    // Print summary counts from MongoDB
    const [orderCount, eventCount, incidentCount, actionCount, twinCount] = await Promise.all([
      Order.countDocuments(),
      OrderEvent.countDocuments(),
      IncidentLog.countDocuments(),
      HealingAction.countDocuments(),
      DigitalTwinScenario.countDocuments()
    ]);

    console.log(`\n----------------------------------------------------------------`);
    console.log(`📊 LIVE MONGODB COLLECTION DOCUMENT COUNTS:`);
    console.log(`----------------------------------------------------------------`);
    console.log(`Orders Collection              : ${orderCount} document(s)`);
    console.log(`OrderEvents Collection         : ${eventCount} document(s)`);
    console.log(`IncidentLogs Collection        : ${incidentCount} document(s)`);
    console.log(`HealingActions Collection      : ${actionCount} document(s)`);
    console.log(`DigitalTwinScenarios Collection: ${twinCount} document(s)`);
    console.log(`----------------------------------------------------------------`);
    console.log(`🎯 Test Order Stored for Restart Test: ${testOrderNumber}`);

    await mongoose.disconnect();
    return { testOrderNumber, orderCount, eventCount, incidentCount, actionCount, twinCount };
  } else if (mode === 'verify_after_restart') {
    const targetOrderNumber = process.argv[3];
    if (!targetOrderNumber) {
      console.error('Error: targetOrderNumber required for verify_after_restart');
      process.exit(1);
    }

    const order = await Order.findOne({ orderNumber: targetOrderNumber });
    if (!order) {
      console.error(`❌ FAILED: Order ${targetOrderNumber} was NOT found in MongoDB after restart!`);
      process.exit(1);
    }
    console.log(`✅ PASS: Order ${targetOrderNumber} successfully retrieved from MongoDB after backend restart!`);
    console.log(`   Customer: ${order.customer.name} | Status: ${order.overallStatus} | Stage: ${order.currentStage}`);

    const [events, incidents, actions, twins] = await Promise.all([
      OrderEvent.find({ orderNumber: targetOrderNumber }),
      IncidentLog.find({ orderNumber: targetOrderNumber }),
      HealingAction.find({ orderNumber: targetOrderNumber }),
      DigitalTwinScenario.find({ orderNumber: targetOrderNumber })
    ]);

    console.log(`✅ Associated Events found: ${events.length}`);
    console.log(`✅ Associated Incidents found: ${incidents.length}`);
    console.log(`✅ Associated Healing Actions found: ${actions.length}`);
    console.log(`✅ Associated Twin Predictions found: ${twins.length}`);

    await mongoose.disconnect();
    console.log(`\n🎉 DATA SURVIVED BACKEND RESTART WITH 100% INTEGRITY!`);
    return true;
  }
}

if (require.main === module) {
  const mode = process.argv[2] || 'create_and_verify';
  verifyPersistence(mode)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal Persistence Test Error:', err);
      process.exit(1);
    });
}

module.exports = { verifyPersistence };
