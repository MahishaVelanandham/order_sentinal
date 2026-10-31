import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
  ArrowUpRight,
  UserCheck
} from 'lucide-react';
import {
  fetchIncidents,
  fetchRecommendations,
  approveResolution,
  rejectRecommendation,
  retryOrder,
  escalateOrder,
  fetchResolutionHistory
} from '../services/api';

export default function ResolutionCentre({
  incidents = [],
  orders = [],
  selectedOrder,
  onNavigateTab,
  onSelectOrder,
  onRefresh
}) {
  const [activeSubTab, setActiveSubTab] = useState('pending'); // 'pending' | 'resolved' | 'escalated'
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [isLoadingRec, setIsLoadingRec] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [resolutionHistory, setResolutionHistory] = useState([]);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);
  const [actionErrorMsg, setActionErrorMsg] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Filter incidents for resolutions
  const pendingIncidents = incidents.filter(
    (i) =>
      i.resolutionStatus === 'PENDING' ||
      i.resolutionStatus === 'OPEN' ||
      i.resolutionStatus === 'AWAITING_APPROVAL' ||
      (!i.resolutionStatus && i.overallStatus !== 'COMPLETED')
  );

  const resolvedIncidents = incidents.filter(
    (i) => i.resolutionStatus === 'AUTO_RESOLVED' || i.resolutionStatus === 'RESOLVED'
  );

  const escalatedIncidents = incidents.filter(
    (i) => i.resolutionStatus === 'ESCALATED' || i.resolutionStatus === 'REJECTED' || i.severity === 'CRITICAL'
  );

  // Sync selected incident
  useEffect(() => {
    if (selectedOrder) {
      const match = incidents.find((i) => i.orderNumber === selectedOrder.orderNumber);
      if (match) setSelectedIncident(match);
      else if (pendingIncidents.length > 0) setSelectedIncident(pendingIncidents[0]);
    } else if (pendingIncidents.length > 0 && !selectedIncident) {
      setSelectedIncident(pendingIncidents[0]);
    }
  }, [selectedOrder, incidents]);

  // Load recommendation when incident changes
  useEffect(() => {
    if (!selectedIncident) return;
    let isMounted = true;
    setIsLoadingRec(true);
    setActionSuccessMsg(null);

    const targetId = selectedIncident.orderNumber || selectedIncident.orderId;
    fetchRecommendations(targetId)
      .then((res) => {
        if (isMounted) {
          setRecommendation(res.recommendation || null);
          setIsOfflineMode(false);
          setIsLoadingRec(false);
        }
      })
      .catch((err) => {
        // Fallback recommendation
        if (isMounted) {
          setIsOfflineMode(true);
          setRecommendation({
            actionId: `REC-${targetId}`,
            orderNumber: targetId,
            failureCategory: selectedIncident.failureCategory || 'API_RESPONSE_ERROR',
            recommendedAction:
              selectedIncident.failureCategory === 'API_RESPONSE_ERROR'
                ? 'RETRY_WITH_EXPONENTIAL_BACKOFF'
                : selectedIncident.failureCategory === 'ORDER_DELAY'
                ? 'EXPEDITE_PRIORITY_ROUTE'
                : 'ESCALATE_TO_OPERATOR',
            decisionReason:
              'Downstream Provisioning timeout detected. Safe idempotent retry within maximum limit (1/3).',
            riskTier: selectedIncident.failureCategory === 'ORDER_REJECTION' ? 'HIGH_RISK' : 'LOW_RISK',
            idempotencyKey: `IDEMP-${targetId}-RETRY-1`,
            maxRetriesAllowed: 3,
            currentRetryCount: 1,
            autoHealEligible: selectedIncident.failureCategory !== 'ORDER_REJECTION'
          });
          setIsLoadingRec(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedIncident]);

  // Handle Approve
  const handleApprove = async () => {
    if (!recommendation && !selectedIncident) return;
    try {
      setIsActing(true);
      setActionErrorMsg(null);
      setActionSuccessMsg(null);
      const actionId = recommendation?.actionId || `ACT-${selectedIncident.orderNumber}`;
      await approveResolution(actionId);
      setActionSuccessMsg(`Resolution successfully executed! Order ${selectedIncident.orderNumber} self-healed.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionErrorMsg('Approval failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsActing(false);
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!selectedIncident) return;
    try {
      setIsActing(true);
      setActionErrorMsg(null);
      setActionSuccessMsg(null);
      const actionId = recommendation?.actionId || `ACT-${selectedIncident.orderNumber}`;
      await rejectRecommendation(actionId, 'Operator rejected automatic recommendation.');
      setActionSuccessMsg(`Recommendation rejected. Order ${selectedIncident.orderNumber} moved to Escalation queue.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionErrorMsg('Rejection failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsActing(false);
    }
  };

  // Direct Retry
  const handleDirectRetry = async () => {
    if (!selectedIncident) return;
    try {
      setIsActing(true);
      setActionErrorMsg(null);
      setActionSuccessMsg(null);
      await retryOrder(selectedIncident.orderNumber);
      setActionSuccessMsg(`Direct idempotent retry triggered for ${selectedIncident.orderNumber}. Order marked COMPLETED.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionErrorMsg('Retry blocked: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsActing(false);
    }
  };

  // Escalate
  const handleEscalate = async () => {
    if (!selectedIncident) return;
    try {
      setIsActing(true);
      setActionErrorMsg(null);
      setActionSuccessMsg(null);
      await escalateOrder(selectedIncident.orderNumber, 'Manual escalation requested from Resolution Centre.');
      setActionSuccessMsg(`Order ${selectedIncident.orderNumber} escalated to telecom tier-2 operations queue.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      setActionErrorMsg('Escalation error: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsActing(false);
    }
  };

  const currentList =
    activeSubTab === 'pending'
      ? pendingIncidents
      : activeSubTab === 'resolved'
      ? resolvedIncidents
      : escalatedIncidents;

  return (
    <div className="space-y-6">
      {/* Offline Demonstration Banner */}
      {isOfflineMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-xs animate-fadeIn">
          <div className="flex items-center space-x-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>OFFLINE DEMONSTRATION MODE – Backend data unavailable.</span>
          </div>
          <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
            Simulated Recommendation
          </span>
        </div>
      )}

      {/* Top Banner and Sub-Tab Navigation */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <HeartHandshake className="w-4 h-4 text-emerald-600" />
            Autonomous Self-Healing & Remediation Hub
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Idempotent automated recovery loops with strict safety guardrails and human escalation
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-lg text-xs">
          <button
            onClick={() => setActiveSubTab('pending')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeSubTab === 'pending'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Pending Actions ({pendingIncidents.length})
          </button>
          <button
            onClick={() => setActiveSubTab('resolved')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeSubTab === 'resolved'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Auto-Resolved ({resolvedIncidents.length})
          </button>
          <button
            onClick={() => setActiveSubTab('escalated')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeSubTab === 'escalated'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Escalations ({escalatedIncidents.length})
          </button>
        </div>
      </div>

      {/* Notification Alerts */}
      {actionErrorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
          <button
            onClick={() => setActionErrorMsg(null)}
            className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {actionSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* 2-Column Remediation Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Remediation Incident Queue (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {activeSubTab === 'pending'
                  ? 'Awaiting Resolution'
                  : activeSubTab === 'resolved'
                  ? 'Recovered Orders'
                  : 'Escalated to Operations'}
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-500">{currentList.length} total</span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
              {currentList.map((inc) => {
                const isSelected = selectedIncident?._id === inc._id || selectedIncident?.incidentId === inc.incidentId;
                const isAutoHeal = inc.failureCategory === 'API_RESPONSE_ERROR' || inc.failureCategory === 'ORDER_DELAY';

                return (
                  <div
                    key={inc._id || inc.incidentId}
                    onClick={() => setSelectedIncident(inc)}
                    className={`p-3.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-50/70 border-l-4 border-l-cyan-600'
                        : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-900">{inc.orderNumber}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          inc.resolutionStatus === 'AUTO_RESOLVED' || inc.resolutionStatus === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inc.resolutionStatus === 'ESCALATED'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {inc.resolutionStatus || 'PENDING'}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-800 mt-1">
                      {inc.failureCategory}
                    </div>

                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                      <span>Stage: {inc.affectedService || inc.failedStage || 'PROVISIONING'}</span>
                      <span className={`font-mono text-[10px] font-semibold ${isAutoHeal ? 'text-emerald-700' : 'text-purple-700'}`}>
                        {isAutoHeal ? 'Auto-Healable' : 'Manual Review'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {currentList.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  Queue is clear. No incidents currently in this category.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Resolution Decision Workbench (8 Cols) */}
        <div className="lg:col-span-8">
          {selectedIncident ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded">
                      {selectedIncident.orderNumber}
                    </span>
                    <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {selectedIncident.failureCategory}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">
                    {selectedIncident.failureReason || 'Simulated Stage Timeout / Rejection'}
                  </h3>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-mono">
                    Correlation: {selectedIncident.correlationId}
                  </span>
                </div>
              </div>

              {/* Recommended Action Decision Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Self-Healing Recommendation Policy
                  </span>
                  <span
                    className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded ${
                      recommendation?.riskTier === 'LOW_RISK'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : recommendation?.riskTier === 'MEDIUM_RISK'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {recommendation?.riskTier || 'LOW_RISK'}
                  </span>
                </div>

                <div className="text-sm font-bold text-slate-800">
                  {recommendation?.recommendedAction || 'RETRY_WITH_EXPONENTIAL_BACKOFF'}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {recommendation?.decisionReason ||
                    'Downstream provisioning gateway returned HTTP 504. Operation is idempotent and qualifies for automated exponential backoff recovery.'}
                </p>

                {/* Safety Guardrails Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-[11px] font-mono text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Idempotency Key:</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {recommendation?.idempotencyKey || `${selectedIncident.orderNumber}-IDEMP-1`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Retry Counter:</span>
                    <span className="font-bold text-slate-800">
                      {recommendation?.currentRetryCount || 1} / {recommendation?.maxRetriesAllowed || 3} max
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Loop Prevention:</span>
                    <span className="text-emerald-700 font-bold">GUARD_ACTIVE</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Financial Safety:</span>
                    <span className="text-emerald-700 font-bold">ZERO_MUTATION</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="p-4 rounded-xl bg-cyan-50/40 border border-cyan-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Execute Remediation</span>
                  <span className="text-[11px] text-slate-500">
                    Idempotent actions update stage telemetry and record audit logs
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Reject / Escalate Button */}
                  <button
                    onClick={handleReject}
                    disabled={isActing}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject Recommendation</span>
                  </button>

                  {/* Direct Retry Button */}
                  <button
                    onClick={handleDirectRetry}
                    disabled={isActing}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    <span>Direct Retry (Backoff)</span>
                  </button>

                  {/* Escalate Button */}
                  <button
                    onClick={handleEscalate}
                    disabled={isActing}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span>Escalate to Human</span>
                  </button>

                  {/* Approve and Execute Resolution Button */}
                  <button
                    onClick={handleApprove}
                    disabled={isActing}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isActing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>Approve & Self-Heal</span>
                  </button>
                </div>
              </div>

              {/* Safety Policy Checklist */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  System Self-Healing Compliance & Constraints
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Non-idempotent operations are never retried blindly</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Max retry ceiling set to 3 to prevent cascading overload</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Hard validation rejections escalated to human tier</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Customer and billing records remain immutable</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              <HeartHandshake className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-700">No Incident Selected</h3>
              <p className="text-xs text-slate-500 mt-1">
                Select an incident from the queue to view its self-healing recommendation and execute actions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
