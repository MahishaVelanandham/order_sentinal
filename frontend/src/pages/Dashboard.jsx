import React, { useState, useEffect } from 'react';
import {
  Flame,
  RotateCcw,
  CheckCircle2,
  Clock,
  Ban,
  PauseCircle,
  Activity,
  Layers,
  ShieldAlert,
  SearchCode,
  X,
  Sparkles,
  HeartHandshake,
  Check,
  History,
  Cpu,
  ArrowRight,
  ShieldCheck,
  GitBranch,
  Star
} from 'lucide-react';
import {
  fetchOrders,
  fetchIncidents,
  fetchResolutionHistory,
  fetchTwinHistory,
  createSimulatedOrder,
  resetChaosSettings,
  runOrderRCA,
  fetchRecommendations,
  approveResolution,
  rejectRecommendation,
  retryOrder,
  escalateOrder,
  predictOrderTwin
} from '../services/api';

export const Dashboard = ({ latestEvent }) => {
  const [orders, setOrders] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [healingHistory, setHealingHistory] = useState([]);
  const [summary, setSummary] = useState({ TOTAL: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRca, setSelectedRca] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [loadingRca, setLoadingRca] = useState(false);
  const [twinAnalysis, setTwinAnalysis] = useState(null);
  const [loadingTwin, setLoadingTwin] = useState(false);
  const [actionLog, setActionLog] = useState([
    {
      id: 1,
      type: 'INFO',
      message: 'Predictive Digital Twin & Self-Healing AI active. Virtual simulations ready...',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);

  const appendLog = (type, message) => {
    setActionLog((prev) => [
      { id: Date.now(), type, message, timestamp: new Date().toLocaleTimeString() },
      ...prev.slice(0, 24)
    ]);
  };

  const loadData = async () => {
    try {
      const [orderRes, incRes, healRes] = await Promise.all([
        fetchOrders({ limit: 10 }),
        fetchIncidents({ limit: 10 }),
        fetchResolutionHistory({ limit: 8 })
      ]);
      if (orderRes.data) setOrders(orderRes.data);
      if (orderRes.summary) setSummary(orderRes.summary);
      if (incRes.data) setIncidents(incRes.data);
      if (healRes.data) setHealingHistory(healRes.data);
    } catch (err) {
      console.warn('Could not load data:', err.message);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen to WebSocket events
  useEffect(() => {
    if (!latestEvent) return;
    if (latestEvent.type === 'order:created') {
      appendLog('INFO', `Order ${latestEvent.data.orderNumber} initiated (${latestEvent.data.scenario})`);
      loadData();
    } else if (latestEvent.type === 'order:failed') {
      appendLog('ERROR', `Order ${latestEvent.data.orderNumber} FAILED at ${latestEvent.data.stage}`);
      loadData();
    } else if (latestEvent.type === 'order:healing') {
      appendLog('INFO', `Self-Healing triggered: ${latestEvent.data.orderNumber} executing ${latestEvent.data.actionType}`);
      loadData();
    } else if (latestEvent.type === 'order:healed') {
      appendLog('SUCCESS', `Self-Healing SUCCESS: ${latestEvent.data.orderNumber} completed all stages!`);
      loadData();
    } else if (latestEvent.type === 'order:escalated') {
      appendLog('WARNING', `Order ${latestEvent.data.orderNumber} escalated to human operator: ${latestEvent.data.reason}`);
      loadData();
    } else if (latestEvent.type === 'twin:predicted') {
      appendLog('INFO', `Digital Twin: What-If simulation completed for ${latestEvent.data.orderNumber}. Safest: ${latestEvent.data.safestScenario.name}`);
    }
  }, [latestEvent]);

  const handleGenerateScenario = async (scenario) => {
    try {
      setIsSubmitting(true);
      const res = await createSimulatedOrder({ scenario });
      const order = res.data;
      appendLog(
        order.overallStatus === 'FAILED' || order.overallStatus === 'REJECTED'
          ? 'ERROR'
          : order.overallStatus === 'DELAYED'
          ? 'WARNING'
          : 'SUCCESS',
        `Simulated [${scenario}] Order ${order.orderNumber} -> Status: ${order.overallStatus}`
      );
      await loadData();
    } catch (err) {
      appendLog('ERROR', `Simulation error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInspectRCA = async (orderNumber) => {
    try {
      setLoadingRca(true);
      const [rcaRes, recRes] = await Promise.all([
        runOrderRCA(orderNumber),
        fetchRecommendations(orderNumber)
      ]);
      setSelectedRca(rcaRes.data.rca);
      setPendingAction(recRes.data);
      appendLog('INFO', `RCA & Recommendation ready for ${orderNumber}: ${recRes.data.actionType}`);
    } catch (err) {
      appendLog('ERROR', `RCA evaluation failed: ${err.message}`);
    } finally {
      setLoadingRca(false);
    }
  };

  const handleRunDigitalTwin = async (orderNumber) => {
    try {
      setLoadingTwin(true);
      const res = await predictOrderTwin(orderNumber, {
        queueDelayMs: 600.0,
        serviceHealthScore: 0.65,
        serviceFailureRate: 0.12
      });
      setTwinAnalysis(res.data);
      appendLog('SUCCESS', `Digital Twin: Predicted What-If scenarios for ${orderNumber}. Safest: ${res.data.safestScenario.name}`);
    } catch (err) {
      appendLog('ERROR', `Digital Twin simulation failed: ${err.message}`);
    } finally {
      setLoadingTwin(false);
    }
  };

  const handleApproveResolution = async (actionId) => {
    try {
      setIsSubmitting(true);
      const res = await approveResolution(actionId);
      appendLog('SUCCESS', `Resolution Approved: ${res.data.executionResult?.responseSummary}`);
      setSelectedRca(null);
      setPendingAction(null);
      await loadData();
    } catch (err) {
      appendLog('ERROR', `Approval failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectRecommendation = async (actionId) => {
    try {
      setIsSubmitting(true);
      const res = await rejectRecommendation(actionId, 'Operator rejected resolution');
      appendLog('WARNING', `Resolution Rejected: ${res.data.actionId} marked for operator review.`);
      setSelectedRca(null);
      setPendingAction(null);
      await loadData();
    } catch (err) {
      appendLog('ERROR', `Rejection failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickRetry = async (orderNumber) => {
    try {
      setIsSubmitting(true);
      const res = await retryOrder(orderNumber);
      appendLog('SUCCESS', `Direct Retry Success: Order ${orderNumber} healed and completed.`);
      await loadData();
    } catch (err) {
      appendLog('ERROR', `Retry error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetChaos = async () => {
    try {
      await resetChaosSettings();
      appendLog('INFO', 'All chaos faults reset to baseline normal.');
    } catch (err) {
      appendLog('ERROR', `Reset error: ${err.message}`);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">COMPLETED</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">FAILED</span>;
      case 'HEALING':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/40 animate-pulse">HEALING</span>;
      case 'DELAYED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">DELAYED</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">REJECTED</span>;
      case 'ESCALATED':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">ESCALATED</span>;
      case 'STUCK':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-950 text-red-300 border border-red-800">STUCK</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">{severity}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Scenario Triggers */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              OrderFlow Sentinel &bull; Predictive Digital Twin &amp; Self-Healing AI
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-semibold flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" />
                Digital Twin Active (ML: 94.6% Accuracy)
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Simulates potential failures before they occur, evaluates What-If scenarios (A, B, C), and prescribes the safest preventative action.
            </p>
          </div>
          <button
            onClick={handleResetChaos}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Faults
          </button>
        </div>

        {/* 5 Scenario Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
          <span className="text-xs text-slate-400 font-semibold mr-1">Simulate Broadband Flow:</span>
          <button
            onClick={() => handleGenerateScenario('SUCCESS')}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            1. Success
          </button>
          <button
            onClick={() => handleGenerateScenario('API_ERROR')}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Flame className="w-3.5 h-3.5" />
            2. API Error (504/500)
          </button>
          <button
            onClick={() => handleGenerateScenario('DELAY')}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Clock className="w-3.5 h-3.5" />
            3. Order Delay (SLA Breach)
          </button>
          <button
            onClick={() => handleGenerateScenario('REJECTION')}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Ban className="w-3.5 h-3.5" />
            4. Rejection (Address/Stock)
          </button>
          <button
            onClick={() => handleGenerateScenario('STUCK')}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-800 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <PauseCircle className="w-3.5 h-3.5" />
            5. Stuck Pipeline
          </button>
        </div>
      </div>

      {/* Metrics Counter Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-slate-400 font-medium">Total Orders</span>
          <p className="text-xl font-bold text-white mt-1">{summary.TOTAL || 0}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-emerald-400 font-medium">Completed</span>
          <p className="text-xl font-bold text-emerald-300 mt-1">{summary.COMPLETED || 0}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-rose-400 font-medium">Failed</span>
          <p className="text-xl font-bold text-rose-300 mt-1">{summary.FAILED || 0}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-amber-400 font-medium">Delayed</span>
          <p className="text-xl font-bold text-amber-300 mt-1">{summary.DELAYED || 0}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-purple-400 font-medium">Rejected</span>
          <p className="text-xl font-bold text-purple-300 mt-1">{summary.REJECTED || 0}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] text-indigo-400 font-medium">Escalated</span>
          <p className="text-xl font-bold text-indigo-300 mt-1">{summary.ESCALATED || 0}</p>
        </div>
      </div>

      {/* PREDICTIVE DIGITAL TWIN WHAT-IF PANEL */}
      {twinAnalysis && (
        <div className="rounded-2xl bg-slate-900 border-2 border-indigo-500/50 p-6 shadow-2xl relative">
          <button
            onClick={() => setTwinAnalysis(null)}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Predictive Digital Twin &bull; What-If Simulation Sandbox
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                  Order: {twinAnalysis.orderNumber}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/20 font-mono">
                  ML Accuracy: {(twinAnalysis.modelAccuracy * 100).toFixed(1)}%
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Simulating future processing paths. Stage: {twinAnalysis.currentStage} &bull; Elapsed: {twinAnalysis.elapsedTimeMs}ms &bull; Expected SLA: {twinAnalysis.expectedSlaMs}ms
              </p>
            </div>
          </div>

          {/* Prescriptive Banner */}
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400 flex-shrink-0" />
            <span className="font-semibold">{twinAnalysis.prescriptiveRecommendation}</span>
          </div>

          {/* What-If Scenarios Grid (A, B, C) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {twinAnalysis.scenarioComparisons.map((sc) => (
              <div
                key={sc.scenarioKey}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  sc.isSafest
                    ? 'bg-gradient-to-b from-indigo-950/60 to-slate-950 border-indigo-500/80 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">{sc.name.split(':')[0]}</span>
                    {sc.isSafest ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500 text-slate-950">
                        <Star className="w-3 h-3 fill-current" />
                        SAFEST ACTION
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">Alternative</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{sc.description}</p>
                  
                  <div className="space-y-1.5 py-2 border-y border-slate-800/80 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Est. Remaining:</span>
                      <span className="text-slate-200">{sc.estimatedProcessingTimeMs}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Expected Total:</span>
                      <span className="text-slate-200">{sc.expectedTotalDurationMs}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">SLA Breach Risk:</span>
                      <span className={sc.predictedSlaBreachRisk > 0.2 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {(sc.predictedSlaBreachRisk * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 text-[11px] text-slate-300">
                  <span className="text-slate-500 block text-[10px] uppercase">Guidance:</span>
                  {sc.recommendedAction}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RCA & Self-Healing Decision Card */}
      {selectedRca && pendingAction && (
        <div className="rounded-2xl bg-slate-900 border-2 border-teal-500/50 p-6 shadow-2xl relative">
          <button
            onClick={() => { setSelectedRca(null); setPendingAction(null); }}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Self-Healing Resolution &bull; Order {selectedRca.orderNumber}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-teal-300 border border-teal-500/20 font-mono">
                  Idempotency: {pendingAction.idempotencyKey}
                </span>
              </h3>
              <p className="text-xs text-slate-400">{selectedRca.rootCauseExplanation}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-3">
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                  Root Cause Diagnosis
                </span>
                <p className="text-sm font-semibold text-white leading-relaxed">
                  {selectedRca.rootCauseExplanation}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-2">
                  Previous Stages State Breakdown
                </span>
                <div className="space-y-1.5">
                  {selectedRca.previousStages.map((stg) => (
                    <div key={stg.stage} className="flex items-center justify-between py-1 border-b border-slate-900 last:border-0 font-mono">
                      <span className="text-slate-300">{stg.stage}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-semibold">{stg.status}</span>
                        <span className="text-slate-500">({stg.latencyMs}ms)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-teal-300">
                    Recommended Resolution
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/20 text-teal-200">
                    Risk Tier: {pendingAction.riskTier}
                  </span>
                </div>
                <p className="text-sm font-semibold text-teal-100 leading-relaxed">
                  {pendingAction.actionType}: {pendingAction.decisionReason}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => handleApproveResolution(pendingAction.actionId)}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  Approve &amp; Execute Resolution
                </button>
                <button
                  onClick={() => handleRejectRecommendation(pendingAction.actionId)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs transition-all disabled:opacity-50"
                >
                  Reject &amp; Escalate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Orders Stream with Digital Twin & Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders Table with Twin Simulator Trigger */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                Live Orders Stream &bull; Digital Twin What-If Sandbox
              </h3>
              <span className="text-xs text-slate-500">Click "Simulate Twin"</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2.5">Order Number</th>
                    <th className="pb-2.5">Customer</th>
                    <th className="pb-2.5">Stage</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5">Duration</th>
                    <th className="pb-2.5">Predictive Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-slate-500">
                        No orders generated yet. Click one of the scenario buttons above!
                      </td>
                    </tr>
                  ) : (
                    orders.map((ord) => (
                      <tr key={ord.orderNumber} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 text-teal-400 font-bold">{ord.orderNumber}</td>
                        <td className="py-3 text-slate-300 font-sans">{ord.customer?.name}</td>
                        <td className="py-3 text-slate-300">{ord.currentStage}</td>
                        <td className="py-3">{getStatusBadge(ord.overallStatus)}</td>
                        <td className="py-3 text-slate-300">{ord.actualProcessingTimeMs}ms</td>
                        <td className="py-3">
                          <button
                            onClick={() => handleRunDigitalTwin(ord.orderNumber)}
                            disabled={loadingTwin}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-sans font-semibold transition-all disabled:opacity-50"
                          >
                            <Cpu className="w-3.5 h-3.5" />
                            Simulate Twin
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Live Action Audit Feed */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
            <span>Live System Feed</span>
            <span className="text-[10px] text-indigo-400 font-mono">Twin Engine Active</span>
          </h3>
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[360px] pr-1">
            {actionLog.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1 font-mono">
                  <span
                    className={
                      log.type === 'ERROR'
                        ? 'text-rose-400'
                        : log.type === 'WARNING'
                        ? 'text-amber-400'
                        : log.type === 'SUCCESS'
                        ? 'text-emerald-400'
                        : 'text-indigo-400'
                    }
                  >
                    [{log.type}]
                  </span>
                  <span>{log.timestamp}</span>
                </div>
                <p className="text-slate-300 leading-relaxed font-sans">{log.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Incidents & Self-Healing Action Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incidents Table */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Detected Incidents (Root Cause Analysis Gate)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2.5">Order</th>
                  <th className="pb-2.5">Category</th>
                  <th className="pb-2.5">Severity</th>
                  <th className="pb-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-slate-500 font-sans">
                      No active failure incidents.
                    </td>
                  </tr>
                ) : (
                  incidents.map((inc) => (
                    <tr key={inc.incidentId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 text-teal-400 font-bold">{inc.orderNumber}</td>
                      <td className="py-3 text-slate-300">{inc.failureCategory}</td>
                      <td className="py-3">{getSeverityBadge(inc.severity)}</td>
                      <td className="py-3">
                        <button
                          onClick={() => handleInspectRCA(inc.orderNumber)}
                          disabled={loadingRca}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[11px] font-sans font-semibold transition-all disabled:opacity-50"
                        >
                          <HeartHandshake className="w-3.5 h-3.5" />
                          Self-Heal
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resolution History Audit Table */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-teal-400" />
            Self-Healing Audit Trail (MongoDB Collection: healing_actions)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2.5">Action ID</th>
                  <th className="pb-2.5">Order</th>
                  <th className="pb-2.5">Remediation</th>
                  <th className="pb-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {healingHistory.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-slate-500 font-sans">
                      No resolution actions recorded yet.
                    </td>
                  </tr>
                ) : (
                  healingHistory.map((act) => (
                    <tr key={act.actionId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 text-slate-400">{act.actionId}</td>
                      <td className="py-3 text-teal-400 font-bold">{act.orderNumber}</td>
                      <td className="py-3 text-slate-200">{act.actionType}</td>
                      <td className="py-3">
                        <span className={act.status === 'COMPLETED' ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                          {act.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
