import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// System Health
export const checkSystemHealth = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};

// Order Simulation & Retrieval
export const fetchOrders = async (params = {}) => {
  const response = await apiClient.get('/orders', { params });
  return response.data;
};

export const fetchOrderById = async (id) => {
  const response = await apiClient.get(`/orders/${id}`);
  return response.data;
};

export const fetchOrderTimeline = async (id) => {
  const response = await apiClient.get(`/orders/${id}/timeline`);
  return response.data;
};

export const createSimulatedOrder = async (orderData = {}) => {
  const response = await apiClient.post('/orders/generate', orderData);
  return response.data;
};

// Chaos & Fault Injection
export const fetchChaosStatus = async () => {
  const response = await apiClient.get('/chaos');
  return response.data;
};

export const updateChaosSettings = async (rules) => {
  const response = await apiClient.post('/chaos/inject', rules);
  return response.data;
};

export const resetChaosSettings = async () => {
  const response = await apiClient.post('/chaos/reset');
  return response.data;
};

// Failure Detection & RCA
export const fetchIncidents = async (params = {}) => {
  const response = await apiClient.get('/incidents', { params });
  return response.data;
};

export const detectOrderFailure = async (orderIdOrNumber) => {
  const response = await apiClient.post(`/incidents/detect/${orderIdOrNumber}`);
  return response.data;
};

export const runOrderRCA = async (orderIdOrNumber) => {
  const response = await apiClient.post(`/incidents/rca/${orderIdOrNumber}`);
  return response.data;
};

export const fetchOrderRCA = async (orderIdOrNumber) => {
  const response = await apiClient.get(`/incidents/rca/${orderIdOrNumber}`);
  return response.data;
};

// Remediation & Self-Healing APIs
export const fetchRecommendations = async (orderId) => {
  const response = await apiClient.get(`/remediation/recommendations/${orderId}`);
  return response.data;
};

export const approveResolution = async (actionId) => {
  const response = await apiClient.post(`/remediation/approve/${actionId}`);
  return response.data;
};

export const rejectRecommendation = async (actionId, reason) => {
  const response = await apiClient.post(`/remediation/reject/${actionId}`, { reason });
  return response.data;
};

export const retryOrder = async (orderId) => {
  const response = await apiClient.post(`/remediation/retry/${orderId}`);
  return response.data;
};

export const escalateOrder = async (orderId, reason) => {
  const response = await apiClient.post(`/remediation/escalate/${orderId}`, { reason });
  return response.data;
};

export const fetchResolutionHistory = async (params = {}) => {
  const response = await apiClient.get('/remediation/history', { params });
  return response.data;
};

// Predictive Digital Twin APIs
export const predictOrderTwin = async (orderId, params = {}) => {
  const response = await apiClient.post(`/twin/predict/${orderId}`, params);
  return response.data;
};

export const fetchTwinHistory = async (params = {}) => {
  const response = await apiClient.get('/twin/history', { params });
  return response.data;
};

export const runDigitalTwinSimulation = async (scenarioParams) => {
  const response = await apiClient.post('/twin/simulate', scenarioParams);
  return response.data;
};

export default apiClient;
