const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderEvent = require('../models/OrderEvent');
const IncidentLog = require('../models/IncidentLog');
const HealingAction = require('../models/HealingAction');
const DigitalTwinScenario = require('../models/DigitalTwinScenario');

/**
 * Storage Service
 * Provides transparent access to MongoDB when available,
 * with an in-memory fallback store if MongoDB is offline.
 */
class StorageService {
  constructor() {
    this.inMemoryOrders = new Map();
    this.inMemoryEvents = [];
    this.inMemoryIncidents = new Map();
    this.inMemoryHealingActions = new Map();
    this.inMemoryTwinPredictions = new Map();
  }

  isMongoReady() {
    return mongoose.connection.readyState === 1;
  }

  // --- ORDER METHODS ---
  async createOrder(data) {
    if (this.isMongoReady()) {
      return await Order.create(data);
    }

    const _id = new mongoose.Types.ObjectId();
    const doc = {
      _id,
      createdAt: new Date(),
      updatedAt: new Date(),
      failureCount: 0,
      slaBreachPredicted: false,
      slaBreachProbability: 0.0,
      isAutoHealed: false,
      stageTimestamps: {},
      actualProcessingTimeMs: 0,
      ...data
    };

    doc.save = async function() {
      doc.updatedAt = new Date();
      return doc;
    };

    this.inMemoryOrders.set(_id.toString(), doc);
    this.inMemoryOrders.set(doc.orderNumber, doc);
    this.inMemoryOrders.set(doc.correlationId, doc);
    return doc;
  }

  async findOrders(filter = {}, options = {}) {
    const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;

    if (this.isMongoReady()) {
      const query = Order.find(filter).sort(sort).skip(skip).limit(limit);
      const [data, total] = await Promise.all([
        query.exec(),
        Order.countDocuments(filter)
      ]);
      return { data, total };
    }

    const seenIds = new Set();
    const results = [];

    for (const order of this.inMemoryOrders.values()) {
      const idStr = order._id.toString();
      if (seenIds.has(idStr)) continue;
      seenIds.add(idStr);

      let match = true;
      if (filter.overallStatus && order.overallStatus !== filter.overallStatus) match = false;
      if (filter.currentStage && order.currentStage !== filter.currentStage) match = false;
      if (filter.scenario && order.scenario !== filter.scenario) match = false;

      if (match) results.push(order);
    }

    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = results.length;
    const paginated = results.slice(skip, skip + limit);
    return { data: paginated, total };
  }

  async findOrderByIdentifier(identifier) {
    if (!identifier) return null;

    if (this.isMongoReady()) {
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        const order = await Order.findById(identifier);
        if (order) return order;
      }
      return await Order.findOne({
        $or: [{ orderNumber: identifier }, { correlationId: identifier }]
      });
    }

    if (this.inMemoryOrders.has(identifier)) {
      return this.inMemoryOrders.get(identifier);
    }
    for (const order of this.inMemoryOrders.values()) {
      if (order._id.toString() === identifier || order.orderNumber === identifier || order.correlationId === identifier) {
        return order;
      }
    }
    return null;
  }

  async updateOrder(order, updateFields) {
    Object.assign(order, updateFields, { updatedAt: new Date() });

    if (this.isMongoReady() && typeof order.save === 'function') {
      return await order.save();
    }
    return order;
  }

  // --- EVENT METHODS ---
  async createOrderEvent(eventData) {
    const enriched = {
      timestamp: new Date(),
      ...eventData
    };

    if (this.isMongoReady()) {
      return await OrderEvent.create(enriched);
    }

    const _id = new mongoose.Types.ObjectId();
    const eventDoc = { _id, ...enriched };
    this.inMemoryEvents.push(eventDoc);
    return eventDoc;
  }

  async findEventsByOrder(order) {
    if (this.isMongoReady()) {
      return await OrderEvent.find({
        $or: [
          { orderId: order._id },
          { orderNumber: order.orderNumber },
          { correlationId: order.correlationId }
        ]
      }).sort({ timestamp: 1 });
    }

    const orderIdStr = order._id.toString();
    const matched = this.inMemoryEvents.filter((ev) => {
      const evOrderIdStr = ev.orderId ? ev.orderId.toString() : '';
      return (
        evOrderIdStr === orderIdStr ||
        ev.orderNumber === order.orderNumber ||
        ev.correlationId === order.correlationId
      );
    });

    matched.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return matched;
  }

  // --- INCIDENT METHODS ---
  async createIncident(incidentData) {
    if (this.isMongoReady()) {
      return await IncidentLog.create(incidentData);
    }

    const _id = new mongoose.Types.ObjectId();
    const doc = {
      _id,
      createdAt: new Date(),
      updatedAt: new Date(),
      resolutionStatus: 'OPEN',
      ...incidentData
    };

    doc.save = async function() {
      doc.updatedAt = new Date();
      return doc;
    };

    this.inMemoryIncidents.set(doc.incidentId, doc);
    this.inMemoryIncidents.set(_id.toString(), doc);
    this.inMemoryIncidents.set(doc.orderNumber, doc);
    return doc;
  }

  async findIncidentByIdentifier(identifier) {
    if (!identifier) return null;

    if (this.isMongoReady()) {
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        const inc = await IncidentLog.findById(identifier);
        if (inc) return inc;
      }
      return await IncidentLog.findOne({
        $or: [
          { incidentId: identifier },
          { orderNumber: identifier },
          { correlationId: identifier }
        ]
      });
    }

    if (this.inMemoryIncidents.has(identifier)) {
      return this.inMemoryIncidents.get(identifier);
    }
    for (const inc of this.inMemoryIncidents.values()) {
      if (inc.incidentId === identifier || inc.orderNumber === identifier || inc.correlationId === identifier) {
        return inc;
      }
    }
    return null;
  }

  async updateIncident(incident, updateFields) {
    Object.assign(incident, updateFields, { updatedAt: new Date() });

    if (this.isMongoReady() && typeof incident.save === 'function') {
      return await incident.save();
    }
    return incident;
  }

  async findIncidents(filter = {}, options = {}) {
    const { limit = 50, skip = 0, sort = { detectionTimestamp: -1 } } = options;

    if (this.isMongoReady()) {
      const query = IncidentLog.find(filter).sort(sort).skip(skip).limit(limit);
      const [data, total] = await Promise.all([
        query.exec(),
        IncidentLog.countDocuments(filter)
      ]);
      return { data, total };
    }

    const seen = new Set();
    const results = [];

    for (const inc of this.inMemoryIncidents.values()) {
      const idStr = inc._id.toString();
      if (seen.has(idStr)) continue;
      seen.add(idStr);

      let match = true;
      if (filter.failureCategory && inc.failureCategory !== filter.failureCategory) match = false;
      if (filter.severity && inc.severity !== filter.severity) match = false;
      if (filter.resolutionStatus && inc.resolutionStatus !== filter.resolutionStatus) match = false;
      if (filter.orderNumber && inc.orderNumber !== filter.orderNumber) match = false;

      if (match) results.push(inc);
    }

    results.sort((a, b) => new Date(b.detectionTimestamp) - new Date(a.detectionTimestamp));
    const total = results.length;
    const paginated = results.slice(skip, skip + limit);
    return { data: paginated, total };
  }

  // --- HEALING ACTION METHODS ---
  async createHealingAction(actionData) {
    if (this.isMongoReady()) {
      return await HealingAction.create(actionData);
    }

    const _id = new mongoose.Types.ObjectId();
    const doc = {
      _id,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'RECOMMENDED',
      ...actionData
    };

    doc.save = async function() {
      doc.updatedAt = new Date();
      return doc;
    };

    this.inMemoryHealingActions.set(doc.actionId, doc);
    this.inMemoryHealingActions.set(doc.idempotencyKey, doc);
    this.inMemoryHealingActions.set(_id.toString(), doc);
    return doc;
  }

  async findHealingActionByIdOrKey(identifier) {
    if (!identifier) return null;

    if (this.isMongoReady()) {
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        const action = await HealingAction.findById(identifier);
        if (action) return action;
      }
      return await HealingAction.findOne({
        $or: [{ actionId: identifier }, { idempotencyKey: identifier }]
      });
    }

    if (this.inMemoryHealingActions.has(identifier)) {
      return this.inMemoryHealingActions.get(identifier);
    }
    for (const action of this.inMemoryHealingActions.values()) {
      if (action.actionId === identifier || action.idempotencyKey === identifier) {
        return action;
      }
    }
    return null;
  }

  async updateHealingAction(action, updateFields) {
    Object.assign(action, updateFields, { updatedAt: new Date() });

    if (this.isMongoReady() && typeof action.save === 'function') {
      return await action.save();
    }
    return action;
  }

  async findHealingActions(filter = {}, options = {}) {
    const { limit = 50, skip = 0, sort = { performedAt: -1 } } = options;

    if (this.isMongoReady()) {
      const query = HealingAction.find(filter).sort(sort).skip(skip).limit(limit);
      const [data, total] = await Promise.all([
        query.exec(),
        HealingAction.countDocuments(filter)
      ]);
      return { data, total };
    }

    const seen = new Set();
    const results = [];

    for (const action of this.inMemoryHealingActions.values()) {
      const idStr = action._id.toString();
      if (seen.has(idStr)) continue;
      seen.add(idStr);

      let match = true;
      if (filter.orderNumber && action.orderNumber !== filter.orderNumber) match = false;
      if (filter.status && action.status !== filter.status) match = false;
      if (filter.actionType && action.actionType !== filter.actionType) match = false;

      if (match) results.push(action);
    }

    results.sort((a, b) => new Date(b.performedAt || b.createdAt) - new Date(a.performedAt || a.createdAt));
    const total = results.length;
    const paginated = results.slice(skip, skip + limit);
    return { data: paginated, total };
  }

  // --- DIGITAL TWIN METHODS ---
  async createTwinPrediction(twinData) {
    if (this.isMongoReady()) {
      return await DigitalTwinScenario.create(twinData);
    }

    const _id = new mongoose.Types.ObjectId();
    const doc = {
      _id,
      createdAt: new Date(),
      ...twinData
    };

    doc.save = async function() {
      return doc;
    };

    this.inMemoryTwinPredictions.set(doc.predictionId, doc);
    this.inMemoryTwinPredictions.set(_id.toString(), doc);
    return doc;
  }

  async findTwinPredictions(filter = {}, options = {}) {
    const { limit = 50, skip = 0, sort = { analysisTimestamp: -1 } } = options;

    if (this.isMongoReady()) {
      const query = DigitalTwinScenario.find(filter).sort(sort).skip(skip).limit(limit);
      const [data, total] = await Promise.all([
        query.exec(),
        DigitalTwinScenario.countDocuments(filter)
      ]);
      return { data, total };
    }

    const seen = new Set();
    const results = [];

    for (const tw of this.inMemoryTwinPredictions.values()) {
      const idStr = tw._id.toString();
      if (seen.has(idStr)) continue;
      seen.add(idStr);

      let match = true;
      if (filter.orderNumber && tw.orderNumber !== filter.orderNumber) match = false;
      if (match) results.push(tw);
    }

    results.sort((a, b) => new Date(b.analysisTimestamp || b.createdAt) - new Date(a.analysisTimestamp || a.createdAt));
    const total = results.length;
    const paginated = results.slice(skip, skip + limit);
    return { data: paginated, total };
  }

  async getStatusSummary() {
    if (this.isMongoReady()) {
      const stats = await Order.aggregate([
        { $group: { _id: '$overallStatus', count: { $sum: 1 } } }
      ]);
      const summary = { TOTAL: 0 };
      stats.forEach((s) => {
        summary[s._id] = s.count;
        summary.TOTAL += s.count;
      });
      return summary;
    }

    const seenIds = new Set();
    const summary = { TOTAL: 0 };
    for (const order of this.inMemoryOrders.values()) {
      const idStr = order._id.toString();
      if (seenIds.has(idStr)) continue;
      seenIds.add(idStr);

      summary.TOTAL++;
      summary[order.overallStatus] = (summary[order.overallStatus] || 0) + 1;
    }
    return summary;
  }
}

module.exports = new StorageService();
