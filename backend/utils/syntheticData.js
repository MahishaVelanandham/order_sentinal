const crypto = require('crypto');

const CUSTOMER_NAMES = [
  'Alex Morgan', 'Priya Sharma', 'Marcus Vance', 'Elena Rostova',
  'David Chen', 'Amina Al-Mansoor', 'Carlos Mendez', 'Sarah Jenkins',
  'Liam O\'Connor', 'Fatima Zahra', 'Kenji Takahashi', 'Chloe Dubois'
];

const STREET_NAMES = [
  '104 Maple Street', '742 Evergreen Terrace', '88 Victoria Park Avenue',
  '512 Silicon Boulevard', '19 Orchard Lane', '405 Harbor View Drive',
  '620 Cedar Crest Court', '310 Riverdale Road', '95 Highland Avenue'
];

const CITIES = [
  { city: 'Springfield', postalCode: '97477', zone: 'Zone-North-Fiber' },
  { city: 'Metroville', postalCode: '94016', zone: 'Zone-Central-Metro' },
  { city: 'Riverdale', postalCode: '90210', zone: 'Zone-South-Suburbs' },
  { city: 'Oakridge', postalCode: '75001', zone: 'Zone-East-Industrial' }
];

const PRODUCT_PLANS = [
  {
    planId: 'PLAN-100M',
    planName: 'Starter Fiber 100 Mbps',
    productType: 'Broadband Fiber 100 Mbps',
    speedMbps: 100,
    monthlyFee: 39.99,
    expectedCompletionTimeMs: 1800
  },
  {
    planId: 'PLAN-300M',
    planName: 'Turbo Fiber 300 Mbps',
    productType: 'Broadband Fiber 300 Mbps',
    speedMbps: 300,
    monthlyFee: 59.99,
    expectedCompletionTimeMs: 2200
  },
  {
    planId: 'PLAN-1000M',
    planName: 'Gigabit Ultra 1000 Mbps',
    productType: 'Broadband Fiber 1000 Mbps',
    speedMbps: 1000,
    monthlyFee: 89.99,
    expectedCompletionTimeMs: 2800
  },
  {
    planId: 'PLAN-2000M',
    planName: 'Pro Multi-Gig 2000 Mbps',
    productType: 'Broadband Fiber 2000 Mbps',
    speedMbps: 2000,
    monthlyFee: 129.99,
    expectedCompletionTimeMs: 3400
  }
];

const ONT_MODELS = [
  'HUAWEI-HG8245H',
  'NOKIA-G240W-B',
  'CALIX-GigaPoint-803G',
  'FIBERHOME-AN5506'
];

/**
 * Generate a synthetic customer
 */
const generateSyntheticCustomer = () => {
  const name = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
  const location = CITIES[Math.floor(Math.random() * CITIES.length)];
  const street = STREET_NAMES[Math.floor(Math.random() * STREET_NAMES.length)];
  const customerRef = `CUST-${Math.floor(10000 + Math.random() * 90000)}`;

  const cleanEmail = name.toLowerCase().replace(/[^a-z]/g, '.') + '@example-telecom.net';
  const phone = `+1-555-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    customerRef,
    name,
    email: cleanEmail,
    phone,
    installationAddress: {
      street,
      city: location.city,
      postalCode: location.postalCode,
      serviceZone: location.zone
    }
  };
};

/**
 * Pick a random synthetic broadband plan
 */
const pickSyntheticPlan = () => {
  return PRODUCT_PLANS[Math.floor(Math.random() * PRODUCT_PLANS.length)];
};

/**
 * Generate synthetic telecom hardware and network credentials
 */
const generateTelecomMetadata = (stage, plan, customer) => {
  const ontModel = ONT_MODELS[Math.floor(Math.random() * ONT_MODELS.length)];
  const hexRand = (len) => crypto.randomBytes(len).toString('hex').toUpperCase();

  switch (stage) {
    case 'CRM':
      return {
        serviceQualification: 'QUALIFIED_GPON_READY',
        maxAvailableSpeedMbps: 2500,
        nearestDistributionPoint: `FTTH-DP-${hexRand(2)}`,
        crmLeadId: `LEAD-${hexRand(4)}`
      };
    case 'ORDER_MANAGEMENT':
      return {
        orchestrationGraphId: `GRAPH-${hexRand(3)}`,
        decompositionStatus: 'SUCCESS',
        workflowEngine: 'Camunda-Telecom-v7',
        targetSlaSeconds: Math.round(plan.expectedCompletionTimeMs / 1000)
      };
    case 'INVENTORY':
      return {
        ontModel,
        ontSerialNumber: `${ontModel.split('-')[0]}-${hexRand(4)}`,
        macAddress: `${hexRand(1)}:${hexRand(1)}:${hexRand(1)}:${hexRand(1)}:${hexRand(1)}:${hexRand(1)}`,
        opticalSplitterPort: `SPL-${customer.installationAddress.serviceZone.slice(-4)}-P0${Math.floor(1 + Math.random() * 8)}`,
        warehouseDepot: 'Central-Depot-Alpha'
      };
    case 'PAYMENT':
      return {
        transactionId: `TXN-${Date.now()}-${hexRand(2)}`,
        paymentMethod: 'AUTO_DEBIT_ACH',
        maskedAccount: `****-****-${Math.floor(1000 + Math.random() * 9000)}`,
        chargeAmount: plan.monthlyFee,
        currency: 'USD',
        gatewayAuthCode: `AUTH-${hexRand(3)}`
      };
    case 'PROVISIONING':
      return {
        oltChassis: `OLT-${customer.installationAddress.serviceZone.replace('Zone-', '').toUpperCase()}-R01`,
        ponPort: `PON-PORT-0${Math.floor(1 + Math.random() * 8)}`,
        assignedIpAddress: `10.${Math.floor(100 + Math.random() * 150)}.${Math.floor(10 + Math.random() * 80)}.${Math.floor(2 + Math.random() * 250)}/24`,
        vlanTag: 100 + Math.floor(Math.random() * 800),
        radiusProfile: `BW_PROFILE_${plan.speedMbps}M_SYMMETRIC`,
        lineSpeedDownMbps: plan.speedMbps,
        lineSpeedUpMbps: Math.round(plan.speedMbps * 0.5)
      };
    case 'NOTIFICATION':
      return {
        dispatchChannels: ['SMS', 'EMAIL'],
        smsGatewayStatus: 'DELIVERED',
        emailMessageId: `<welcome-${hexRand(4)}@broadband-network.net>`,
        technicianVisitWindow: 'Self-Installation Kit Activated Instantaneously',
        notificationDispatchTimestamp: new Date().toISOString()
      };
    default:
      return {};
  }
};

module.exports = {
  generateSyntheticCustomer,
  pickSyntheticPlan,
  generateTelecomMetadata,
  PRODUCT_PLANS
};
