import React, { useState } from 'react';
import {
  Activity,
  PlusCircle,
  RefreshCw,
  Flame,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ChevronDown
} from 'lucide-react';
import { createSimulatedOrder, updateChaosSettings, resetChaosSettings } from '../services/api';

export default function Header({
  activeTab,
  onRefresh,
  systemHealth,
  isLoading,
  onOrderCreated
}) {
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showChaosModal, setShowChaosModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState('SUCCESS');
  const [chaosForm, setChaosForm] = useState({
    failStage: 'PROVISIONING',
    errorCode: 504,
    probability: 100,
    injectDelayMs: 2500,
    rejectReason: 'FIBER_PORT_EXHAUSTED'
  });

  const pageTitles = {
    overview: {
      title: 'Operations Overview',
      subtitle: 'Real-time order pipeline health, SLA metrics & self-healing telemetry'
    },
    monitoring: {
      title: 'Order Monitoring',
      subtitle: 'Track in-flight and completed telecom broadband orders across all stages'
    },
    details: {
      title: 'Order Details & Journey Timeline',
      subtitle: 'End-to-end stage telemetry: CRM, OMS, Inventory, Payment, Provisioning, Notification'
    },
    failure: {
      title: 'Failure Analysis & Root Cause (RCA)',
      subtitle: 'AI-assisted diagnosis, error attribution, evidence collection, and resolution actions'
    },
    twin: {
      title: 'Predictive Digital Twin',
      subtitle: 'What-If multi-scenario risk simulation & proactive SLA breach prevention'
    },
    resolutions: {
      title: 'Self-Healing Resolution Centre',
      subtitle: 'Autonomous recovery queue, idempotent retries, token refresh, and human approval'
    },
    audit: {
      title: 'Audit & Remediation Trail',
      subtitle: 'Immutable record of autonomous and manual actions with idempotency verification'
    }
  };

  const handleCreateOrder = async (scenario) => {
    try {
      setIsGenerating(true);
      const res = await createSimulatedOrder({ scenario, count: 1 });
      setShowOrderModal(false);
      if (onOrderCreated) {
        onOrderCreated(res.orders ? res.orders[0] : null);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to create simulated order:', err);
      alert('Failed to generate order: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyChaos = async () => {
    try {
      await updateChaosSettings({
        stage: chaosForm.failStage,
        httpStatus: parseInt(chaosForm.errorCode, 10),
        probability: parseFloat(chaosForm.probability) / 100,
        delayMs: parseInt(chaosForm.injectDelayMs, 10),
        reason: chaosForm.rejectReason
      });
      setShowChaosModal(false);
      alert(`Chaos injected on stage: ${chaosForm.failStage}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Chaos injection error: ' + err.message);
    }
  };

  const handleResetChaos = async () => {
    try {
      await resetChaosSettings();
      setShowChaosModal(false);
      alert('Chaos rules reset to normal operation.');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Reset error: ' + err.message);
    }
  };

  const currentMeta = pageTitles[activeTab] || pageTitles.overview;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Page Title & Breadcrumb */}
      <div>
        <h2 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
          {currentMeta.title}
        </h2>
        <p className="text-xs text-slate-500 font-normal">{currentMeta.subtitle}</p>
      </div>

      {/* Action Controls & Health */}
      <div className="flex items-center space-x-3">
        {/* System Health Status Indicator */}
        <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                systemHealth?.healthy !== false ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span className="font-semibold text-slate-700">Cluster:</span>
            <span className="text-emerald-700 font-medium">
              {systemHealth?.healthy !== false ? 'HEALTHY' : 'DEGRADED'}
            </span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] text-slate-500 font-mono">
            AI ML: {systemHealth?.aiService || 'Active'}
          </span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-600' : ''}`} />
        </button>

        {/* Chaos Injection Modal Button */}
        <button
          onClick={() => setShowChaosModal(true)}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 transition-all shadow-sm"
        >
          <Flame className="w-3.5 h-3.5 text-amber-600" />
          <span>Fault Injector</span>
        </button>

        {/* Generate Order Button */}
        <div className="relative">
          <button
            onClick={() => setShowOrderModal(true)}
            disabled={isGenerating}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 shadow-sm transition-all disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Simulate Order</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* MODAL: Generate Order Scenarios */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Simulate Broadband Order</h3>
                <p className="text-xs text-slate-500">Inject synthetic customer flow across telecom pipeline</p>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-3">
              {[
                {
                  id: 'SUCCESS',
                  title: '1. Golden Path (Success)',
                  desc: 'All 6 stages complete smoothly within expected SLA (~1.8s)'
                },
                {
                  id: 'API_ERROR',
                  title: '2. API Timeout / 504 Failure',
                  desc: 'Provisioning or Payment gateway fails with HTTP 504/500'
                },
                {
                  id: 'DELAY',
                  title: '3. Processing Delay / SLA Threat',
                  desc: 'Simulates fiber dispatch delay exceeding SLA threshold (>5s)'
                },
                {
                  id: 'REJECTION',
                  title: '4. Validation Rejection',
                  desc: 'Address unserviceable or duplicate broadband order detected'
                },
                {
                  id: 'STUCK',
                  title: '5. Pipeline Stuck / Missing Callback',
                  desc: 'Order hangs at inventory allocation without state transition'
                }
              ].map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start space-x-3 ${
                    selectedScenario === sc.id
                      ? 'border-cyan-500 bg-cyan-50/70 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="scenario"
                    checked={selectedScenario === sc.id}
                    onChange={() => setSelectedScenario(sc.id)}
                    className="mt-0.5 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{sc.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{sc.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => setShowOrderModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreateOrder(selectedScenario)}
                disabled={isGenerating}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Dispatch Simulated Order</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Fault Injector */}
      {showChaosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 bg-amber-50/70 border-b border-amber-200/80 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-600" />
                  Chaos & Fault Injection Engine
                </h3>
                <p className="text-xs text-amber-700">Introduce controlled errors in pipeline stages</p>
              </div>
              <button
                onClick={() => setShowChaosModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Telecom Stage</label>
                <select
                  value={chaosForm.failStage}
                  onChange={(e) => setChaosForm({ ...chaosForm, failStage: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="CRM">1. CRM (Customer Validation)</option>
                  <option value="OMS">2. Order Management System</option>
                  <option value="INVENTORY">3. Inventory & Port Allocation</option>
                  <option value="PAYMENT">4. Billing & Payment Gateway</option>
                  <option value="PROVISIONING">5. Provisioning & Fiber Activation</option>
                  <option value="NOTIFICATION">6. SMS/Email Notification</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">HTTP Fault Code</label>
                  <select
                    value={chaosForm.errorCode}
                    onChange={(e) => setChaosForm({ ...chaosForm, errorCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="504">504 Gateway Timeout</option>
                    <option value="502">502 Bad Gateway</option>
                    <option value="500">500 Internal Error</option>
                    <option value="429">429 Rate Limit (Throttled)</option>
                    <option value="401">401 Auth Expired</option>
                    <option value="422">422 Unprocessable Order</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Injected Delay (ms)</label>
                  <input
                    type="number"
                    value={chaosForm.injectDelayMs}
                    onChange={(e) => setChaosForm({ ...chaosForm, injectDelayMs: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="2500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Failure Reason Description</label>
                <input
                  type="text"
                  value={chaosForm.rejectReason}
                  onChange={(e) => setChaosForm({ ...chaosForm, rejectReason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="e.g. Optical Line Terminal upstream timeout"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={handleResetChaos}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800"
              >
                Reset All Chaos
              </button>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowChaosModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyChaos}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700"
                >
                  Apply Fault Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
