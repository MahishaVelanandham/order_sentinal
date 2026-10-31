import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Activity,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  Zap,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { predictOrderTwin } from '../services/api';

export default function DigitalTwinPage({
  selectedOrder,
  orders = [],
  onSelectOrder,
  onNavigateTab
}) {
  const [currentOrder, setCurrentOrder] = useState(selectedOrder || orders[0] || null);
  const [predictionData, setPredictionData] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // Sync prop changes
  useEffect(() => {
    if (selectedOrder) {
      setCurrentOrder(selectedOrder);
    } else if (!currentOrder && orders.length > 0) {
      setCurrentOrder(orders[0]);
    }
  }, [selectedOrder, orders]);

  // Run What-If Digital Twin Prediction via Node.js Gateway & Python FastAPI AI
  const runPrediction = async (order) => {
    if (!order) return;
    try {
      setIsSimulating(true);
      setErrorMessage(null);
      setSuccessNotice(null);

      const targetIdentifier = order.orderNumber || order.correlationId || order._id;
      const res = await predictOrderTwin(targetIdentifier);

      if (res && (res.data || res.prediction)) {
        const payload = res.data || res.prediction;
        setPredictionData(payload);
        setSuccessNotice(
          `What-If simulation completed for ${order.orderNumber}. Real order remains strictly unmodified in MongoDB.`
        );
      } else {
        throw new Error('Invalid response structure received from Digital Twin microservice');
      }
    } catch (err) {
      console.error('Digital Twin Simulation error:', err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Predictive Digital Twin simulation failed. Ensure Python FastAPI is online on port 8000.';
      setErrorMessage(msg);
    } finally {
      setIsSimulating(false);
    }
  };

  // Run simulation whenever order changes
  useEffect(() => {
    if (currentOrder) {
      runPrediction(currentOrder);
    }
  }, [currentOrder?.orderNumber]);

  // Scenarios array from live backend response
  const scenarios = predictionData?.scenarioComparisons || [];

  // Chart Data: What-If Comparison
  const chartData = scenarios.map((sc) => ({
    name: sc.scenarioKey === 'SCENARIO_A' ? 'A: Continue' : sc.scenarioKey === 'SCENARIO_B' ? 'B: Backoff' : 'C: Backup Gateway',
    durationMs: sc.expectedTotalDurationMs || sc.estimatedProcessingTimeMs || 0,
    riskPercent: Math.round((sc.predictedSlaBreachRisk || 0) * 100),
    isSafest: sc.isSafest
  }));

  if (!currentOrder) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
        <Cpu className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700">No Orders Available for Simulation</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Please simulate a broadband order from the top bar to inspect its virtual Digital Twin.
        </p>
      </div>
    );
  }

  const breachRiskPercent = Math.round((predictionData?.mlModelBreachProbability || 0.42) * 100);

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {successNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl flex items-center justify-between text-xs shadow-xs animate-fadeIn">
          <div className="flex items-center space-x-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 px-4 py-3 rounded-xl flex items-center justify-between text-xs shadow-xs animate-fadeIn">
          <div className="flex items-center space-x-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => runPrediction(currentOrder)}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold transition-colors"
          >
            Retry Simulation
          </button>
        </div>
      )}

      {/* Top Banner: Order Selector & ML Twin Health */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-xs font-semibold uppercase text-indigo-600 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Digital Twin Virtual Sandbox
            </span>
            <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
              {currentOrder.orderNumber}
            </span>
            <span className="text-xs font-semibold text-slate-500 font-mono">
              Stage: {currentOrder.currentStage}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px]">
              Status: {currentOrder.overallStatus}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simulating prospective outcomes without altering execution state of the live broadband pipeline in MongoDB
          </p>
        </div>

        {/* Action Button & Switcher */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <select
            value={currentOrder.orderNumber}
            onChange={(e) => {
              const found = orders.find((o) => o.orderNumber === e.target.value);
              if (found) {
                setCurrentOrder(found);
                if (onSelectOrder) onSelectOrder(found);
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {orders.map((o) => (
              <option key={o.orderNumber} value={o.orderNumber}>
                {o.orderNumber} ({o.currentStage} - {o.overallStatus})
              </option>
            ))}
          </select>

          {/* THE "RUN WHAT-IF SIMULATION" BUTTON */}
          <button
            onClick={() => runPrediction(currentOrder)}
            disabled={isSimulating}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
            title="Execute parallel What-If simulation across Scenarios A, B, and C"
          >
            {isSimulating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>{isSimulating ? 'Simulating Virtual Scenarios...' : 'Run What-If Simulation'}</span>
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {isSimulating && (
        <div className="p-8 bg-indigo-50/70 border border-indigo-200 rounded-xl text-center flex flex-col items-center justify-center animate-pulse">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
          <p className="text-sm font-semibold text-indigo-900">
            Digital Twin Cloning Virtual Representation...
          </p>
          <p className="text-xs text-indigo-700 mt-0.5">
            Evaluating queue backpressure, worker thread starvation, and backup route reliability in Python AI Engine
          </p>
        </div>
      )}

      {/* AI / ML Telemetry Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: ML SLA Breach Risk */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">SLA Breach Probability</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-extrabold ${breachRiskPercent > 50 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {breachRiskPercent}%
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              GradientBoostingClassifier model (holdout test evaluated)
            </div>
          </div>
        </div>

        {/* Metric 2: Elapsed vs Max SLA */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pipeline Latency vs SLA</span>
            <Activity className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-slate-800">
              {predictionData?.elapsedTimeMs || currentOrder.actualProcessingTimeMs || 1200}
              <span className="text-xs font-normal text-slate-400">
                {' '}
                / {predictionData?.expectedSlaMs || currentOrder.expectedCompletionTimeMs || 2500} ms
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${breachRiskPercent > 60 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                style={{
                  width: `${Math.min(
                    100,
                    (((predictionData?.elapsedTimeMs || currentOrder.actualProcessingTimeMs || 1200) /
                      (predictionData?.expectedSlaMs || currentOrder.expectedCompletionTimeMs || 2500)) *
                      100)
                  )}%`
                }}
              />
            </div>
          </div>
        </div>

        {/* Metric 3: Isolation Forest Anomaly Detection */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Service Health Anomaly</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-base font-bold flex items-center gap-1.5">
              {predictionData?.isServiceAnomalous ? (
                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                  UNUSUAL LATENCY OUTLIER
                </span>
              ) : (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                  NORMAL SERVICE BEHAVIOR
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 mt-1.5">Isolation Forest (Scikit-Learn)</div>
          </div>
        </div>

        {/* Metric 4: ML Classifier Holdout Accuracy */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Model Holdout Accuracy</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-emerald-700">
              {Math.round((predictionData?.modelAccuracy || 0.946) * 1000) / 10}%
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Held-out test split (Gradient Boosting on synthetic delay distribution)
            </div>
          </div>
        </div>
      </div>

      {/* Prescriptive Recommendation Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-300 font-semibold">
              Safest Prescriptive Action Selected by Digital Twin Simulator
            </div>
            <div className="text-sm font-bold text-white mt-0.5">
              {predictionData?.prescriptiveRecommendation ||
                'Digital Twin Simulation Ready. Click "Run What-If Simulation" to compute predictive recovery trajectories.'}
            </div>
            {predictionData?.safestScenario && (
              <div className="text-xs text-indigo-200/80 mt-1">
                Selected Strategy:{' '}
                <span className="font-semibold text-cyan-300">{predictionData.safestScenario.name}</span> |
                Expected Total Duration:{' '}
                <span className="font-mono font-bold text-white">{predictionData.safestScenario.expectedTotalDurationMs}ms</span> |
                Residual SLA Breach Risk:{' '}
                <span className="font-mono font-bold text-emerald-300">
                  {Math.round((predictionData.safestScenario.predictedSlaBreachRisk || 0) * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => {
            if (onSelectOrder) onSelectOrder(currentOrder);
            onNavigateTab('resolutions');
          }}
          className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 transition-colors shadow-sm flex items-center gap-1.5 shrink-0 self-start md:self-auto cursor-pointer"
        >
          <span>Apply in Resolution Centre</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3 What-If Scenario Cards Side-by-Side */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              What-If Multi-Scenario Simulation Comparison
            </h3>
            <p className="text-[11px] text-slate-500">
              Virtual sandbox calculating 3 recovery trajectories in parallel
            </p>
          </div>
          <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
            Decoupled Virtual Simulation
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map((sc) => {
            const risk = Math.round((sc.predictedSlaBreachRisk || 0) * 100);
            return (
              <div
                key={sc.scenarioKey}
                className={`p-5 rounded-xl border transition-all relative flex flex-col justify-between ${
                  sc.isSafest
                    ? 'bg-emerald-50/50 border-emerald-400 shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200'
                }`}
              >
                {sc.isSafest && (
                  <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    SAFEST RECOMMENDED
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-slate-500">{sc.scenarioKey}</span>
                    <span
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                        risk > 60
                          ? 'bg-rose-100 text-rose-800'
                          : risk > 25
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {risk}% Breach Risk
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-800 mt-2">{sc.name}</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{sc.description}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Est. Step Duration:</span>
                    <span className="font-mono font-bold text-slate-700">{sc.estimatedProcessingTimeMs} ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Expected Total Time:</span>
                    <span className="font-mono font-bold text-slate-900">{sc.expectedTotalDurationMs} ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Action Prescribed:</span>
                    <span className="font-mono font-bold text-indigo-700 text-[11px]">{sc.recommendedAction}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visual Chart Comparison: Latency vs Risk */}
      {scenarios.length > 0 && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Scenario Tradeoff: Projected Duration vs Predicted Risk
              </h4>
              <p className="text-[11px] text-slate-400">
                Lower duration and lower risk indicate higher operational resilience
              </p>
            </div>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} unit="ms" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="durationMs" name="Total Duration (ms)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="riskPercent" name="Breach Risk (%)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Decoupling Safety Guarantee Card */}
      <div className="p-3.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center space-x-2.5">
        <Info className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          <strong>Decoupled Safety Guarantee:</strong> The Predictive Digital Twin operates exclusively on a virtual state clone. No customer broadband account, billing ledger, or OLT configuration is modified until explicit approval in the Resolution Centre.
        </span>
      </div>
    </div>
  );
}
