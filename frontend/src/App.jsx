import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import OverviewDashboard from './pages/OverviewDashboard';
import OrderMonitoring from './pages/OrderMonitoring';
import OrderDetails from './pages/OrderDetails';
import FailureAnalysis from './pages/FailureAnalysis';
import DigitalTwinPage from './pages/DigitalTwinPage';
import ResolutionCentre from './pages/ResolutionCentre';
import AuditLogs from './pages/AuditLogs';

import {
  fetchOrders,
  fetchIncidents,
  checkSystemHealth,
  createSimulatedOrder
} from './services/api';
import { usePipelineSocket } from './hooks/usePipelineSocket';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [systemHealth, setSystemHealth] = useState({ healthy: true, aiService: 'Ready' });
  const [isLoading, setIsLoading] = useState(false);

  const { isConnected: socketConnected, latestEvent } = usePipelineSocket();

  // Load all telemetry from Node.js backend
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [ordersRes, incidentsRes, healthRes] = await Promise.allSettled([
        fetchOrders({ limit: 50 }),
        fetchIncidents({ limit: 50 }),
        checkSystemHealth()
      ]);

      if (ordersRes.status === 'fulfilled' && ordersRes.value) {
        const orderList = ordersRes.value.data || [];
        setOrders(orderList);
        setSummary(ordersRes.value.summary || {});

        // Keep selected order in sync or default to first
        if (!selectedOrder && orderList.length > 0) {
          setSelectedOrder(orderList[0]);
        }
      }

      if (incidentsRes.status === 'fulfilled' && incidentsRes.value) {
        setIncidents(incidentsRes.value.data || incidentsRes.value.incidents || []);
      }

      if (healthRes.status === 'fulfilled' && healthRes.value) {
        setSystemHealth({
          healthy: healthRes.value.status === 'UP' || healthRes.value.success !== false,
          aiService: healthRes.value.dependencies?.aiEngine?.status === 'UP' ? 'Online' : 'Active'
        });
      }
    } catch (err) {
      console.warn('Data refresh notice:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrder]);

  // Initial load
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000); // 20s background sync
    return () => clearInterval(interval);
  }, [loadData]);

  // Listen to WebSocket events to auto-refresh when orders are created or healed
  useEffect(() => {
    if (latestEvent) {
      loadData();
    }
  }, [latestEvent, loadData]);

  // Quick scenario generator
  const handleGenerateScenario = async (scenario) => {
    try {
      setIsLoading(true);
      const res = await createSimulatedOrder({ scenario, count: 1 });
      const newOrder = res.orders ? res.orders[0] : null;
      if (newOrder) {
        setSelectedOrder(newOrder);
      }
      await loadData();
    } catch (err) {
      alert('Error creating scenario order: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const pendingCount = incidents.filter(
    (i) => i.resolutionStatus === 'PENDING' || i.resolutionStatus === 'AWAITING_APPROVAL' || (!i.resolutionStatus && i.overallStatus !== 'COMPLETED')
  ).length;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
      {/* Dark Navy Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        incidentCount={incidents.length}
        pendingResolutions={pendingCount}
      />

      {/* Main App Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          onRefresh={loadData}
          systemHealth={systemHealth}
          isLoading={isLoading}
          onOrderCreated={(order) => {
            if (order) setSelectedOrder(order);
            loadData();
          }}
        />

        {/* Dynamic Page Views */}
        <main className="p-6 flex-1 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === 'overview' && (
            <OverviewDashboard
              orders={orders}
              summary={summary}
              incidents={incidents}
              onSelectOrder={setSelectedOrder}
              onNavigateTab={setActiveTab}
              onGenerateScenario={handleGenerateScenario}
            />
          )}

          {activeTab === 'monitoring' && (
            <OrderMonitoring
              orders={orders}
              isLoading={isLoading}
              onSelectOrder={setSelectedOrder}
              onNavigateTab={setActiveTab}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'details' && (
            <OrderDetails
              selectedOrder={selectedOrder}
              orders={orders}
              onSelectOrder={setSelectedOrder}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'failure' && (
            <FailureAnalysis
              incidents={incidents}
              orders={orders}
              selectedOrder={selectedOrder}
              onNavigateTab={setActiveTab}
              onSelectOrder={setSelectedOrder}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'twin' && (
            <DigitalTwinPage
              selectedOrder={selectedOrder}
              orders={orders}
              onSelectOrder={setSelectedOrder}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'resolutions' && (
            <ResolutionCentre
              incidents={incidents}
              orders={orders}
              selectedOrder={selectedOrder}
              onNavigateTab={setActiveTab}
              onSelectOrder={setSelectedOrder}
              onRefresh={loadData}
            />
          )}

          {activeTab === 'audit' && <AuditLogs onRefresh={loadData} />}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-3 px-6 text-center text-xs text-slate-400">
          OrderFlow Sentinel &bull; Self-Healing AI & Predictive Digital Twin &bull; Final Year College Engineering Project
        </footer>
      </div>
    </div>
  );
}
