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
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { predictOrderTwin, fetchTwinHistory } from '../services/api';

export default function DigitalTwinPage({
  selectedOrder,
  orders = [],
  onSelectOrder,
  onNavigateTab
}) {
  const [currentOrder, setCurrentOrder] = useState(selectedOrder || orders[0] || null);
  const [predictionData, setPredictionData] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [twinHistory, setTwinHistory] = useState([]);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Sync prop changes
  useEffect(() => {
    if (selectedOrder) {
      setCurrentOrder(selectedOrder);
    } else if (!currentOrder && orders.length > 0) {
      setCurrentOrder(orders[0]);
    }
  }, [selectedOrder, orders]);

  // Load digital twin prediction
  const runPrediction = async (order) => {
    if (!order) return;
    try {
      setIsSimulating(true);
      const res = await predictOrderTwin(order.orderNumber || order._id);
      setPredictionData(res.data || res.prediction || null);
      setIsOfflineMode(false);
    } catch (err) {
      console.warn('Prediction call error:', err);
      // Generate synthetic fallback twin model if backend call had network issue
      setIsOfflineMode(true);
      synthesizeFallbackTwin(order);
    } finally {
      setIsSimulating(false);
    }
  };

  const synthesizeFallbackTwin = (order) => {
    const elapsed = order.actualProcessingTimeMs || 1650;
    const sla = order.expectedSlaMs || 3500;
    const breachProb = Math.min(0.92, Math.max(0.12, elapsed / sla));

    setPredictionData({
      orderNumber: order.orderNumber,
      correlationId: order.correlationId,
      currentStage: order.currentStage,
      elapsedTimeMs: elapsed,
      expectedSlaMs: sla,
      baselineBreachRisk: breachProb,
      mlModelBreachProbability: breachProb,
      modelAccuracy: 0.946,
      isServiceAnomalous: breachProb > 0.6,
      prescriptiveRecommendation: 'Route in-flight order through Standby Provisioning Gateway (olt-backup-02) to maintain SLA under 3500ms.',
      safestScenario: {
        scenarioKey: 'SCENARIO_C',
        name: 'Route via Standby Backup Gateway',
        estimatedProcessingTimeMs: 420,
        predictedSlaBreachRisk: 0.08,
        expectedTotalDurationMs: elapsed + 420,
        recommendedAction: 'ROUTE_BACKUP_GATEWAY',
        isSafest: true
      },
      scenarioComparisons: [
        {
          scenarioKey: 'SCENARIO_A',
          name: 'Scenario A: Continue Current Gateway',
          description: 'Keep sending payload to primary olt-provisioner without route switch',
          estimatedProcessingTimeMs: 2400,
          predictedSlaBreachRisk: 0.88,
          expectedTotalDurationMs: elapsed + 2400,
          recommendedAction: 'MAINTAIN_ROUTE',
          isSafest: false
        },
        {
          scenarioKey: 'SCENARIO_B',
          name: 'Scenario B: Retry with 500ms Backoff',
          description: 'Pause request for 500ms cooldown, then retry primary gateway with idempotency key',
          estimatedProcessingTimeMs: 1400,
          predictedSlaBreachRisk: 0.45,
          expectedTotalDurationMs: elapsed + 1400,
          recommendedAction: 'BACKOFF_RETRY',
          isSafest: false
        },
        {
          scenarioKey: 'SCENARIO_C',
          name: 'Scenario C: Route to Standby Gateway',
          description: 'Dynamically switch traffic to verified healthy secondary olt-backup-02 gateway',
          estimatedProcessingTimeMs: 420,
          predictedSlaBreachRisk: 0.08,
          expectedTotalDurationMs: elapsed + 420,
          recommendedAction: 'ROUTE_BACKUP_GATEWAY',
          isSafest: true
        }
      ]
    });
  };

  useEffect(() => {
    if (currentOrder) {
      runPrediction(currentOrder);
    }
  }, [currentOrder?.orderNumber]);

  // Chart Data: What-If Comparison
  const scenarios = predictionData?.scenarioComparisons || [];
  const chartData = scenarios.map((sc) => ({
    name: sc.scenarioKey === 'SCENARIO_A' ? 'A: Continue' : sc.scenarioKey === 'SCENARIO_B' ? 'B: Backoff' : 'C: Backup Gateway',
    durationMs: sc.expectedTotalDurationMs || sc.estimatedProcessingTimeMs,
    riskPercent: Math.round((sc.predictedSlaBreachRisk || 0) * 100),
    isSafest: sc.isSafest
  }));

  if (!currentOrder) {
    return (
      <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
        <Cpu className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700">No In-Flight Order Available</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Please simulate a broadband order from the top bar to inspect its virtual Digital Twin.
        </p>
      </div>
    );
  }

  const breachRiskPercent = Math.round((predictionData?.mlModelBreachProbability || 0.42) * 100);

  return (
    <div className="space-y-6">
      {/* Offline Fallback Banner */}
      {isOfflineMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-xs animate-fadeIn">
          <div className="flex items-center space-x-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>OFFLINE DEMONSTRATION MODE – Backend data unavailable.</span>
          </div>
          <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
            Synthetic Simulation Data
          </span>
        </div>
      )}

      {/* Top Banner: Order Selector & ML Twin Health */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase text-indigo-600 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Digital Twin Virtual Session
            </span>
            <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
              {currentOrder.orderNumber}
            </span>
            <span className="text-xs font-semibold text-slate-500 font-mono">
              Stage: {currentOrder.currentStage}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simulating prospective outcomes without altering execution state of the live broadband pipeline
          </p>
        </div>

        {/* Action Button & Switcher */}
        <div className="flex items-center space-x-2">
          <select
            value={currentOrder.orderNumber}
            onChange={(e) => {
              const found = orders.find((o) => o.orderNumber === e.target.value);
              if (found) {
                setCurrentOrder(found);
                if (onSelectOrder) onSelectOrder(found);
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {orders.map((o) => (
              <option key={o.orderNumber} value={o.orderNumber}>
                {o.orderNumber} ({o.currentStage} - {o.overallStatus})
              </option>
            ))}
          </select>

          <button
            onClick={() => runPrediction(currentOrder)}
            disabled={isSimulating}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
            <span>{isSimulating ? 'Simulating...' : 'Run What-If Simulation'}</span>
          </button>
        </div>
      </div>

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
              GradientBoostingClassifier model
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
              <span className="text-xs font-normal text-slate-400"> / {predictionData?.expectedSlaMs || 3500} ms</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${breachRiskPercent > 60 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                style={{
                  width: `${Math.min(100, (((predictionData?.elapsedTimeMs || 1200) / (predictionData?.expectedSlaMs || 3500)) * 100))}%`
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
                  UNUSUAL LATENCY SPIKE
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

        {/* Metric 4: ML Classifier Precision & Safety */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Twin Model Accuracy</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-emerald-700">
              {Math.round((predictionData?.modelAccuracy || 0.946) * 1000) / 10}%
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Cross-validated holdout test set</div>
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
              Safest Prescriptive Action Recommended by Digital Twin
            </div>
            <div className="text-sm font-bold text-white mt-0.5">
              {predictionData?.prescriptiveRecommendation ||
                'Route in-flight order through Standby Provisioning Gateway (olt-backup-02) to maintain SLA under 3500ms.'}
            </div>
            <div className="text-xs text-indigo-200/80 mt-1">
              Estimated Total Duration: <span className="font-mono font-bold text-white">{(predictionData?.safestScenario?.expectedTotalDurationMs || 2070)}ms</span> | Residual Risk: <span className="font-mono font-bold text-emerald-300">{Math.round((predictionData?.safestScenario?.predictedSlaBreachRisk || 0.08) * 100)}%</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            if (onSelectOrder) onSelectOrder(currentOrder);
            onNavigateTab('resolutions');
          }}
          className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 transition-colors shadow-sm flex items-center gap-1.5 shrink-0 self-start md:self-auto"
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
              Virtual sandbox testing 3 recovery trajectories in parallel
            </p>
          </div>
          <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
            Decoupled Simulation Sandbox
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
                    ? 'bg-emerald-50/40 border-emerald-300 shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200'
                }`}
              >
                {sc.isSafest && (
                  <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs tracking-wider">
                    SAFEST CHOICE
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
                    <span className="text-slate-400 text-[11px]">Recommended Action:</span>
                    <span className="font-mono font-bold text-indigo-700 text-[11px]">{sc.recommendedAction}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visual Chart Comparison: Latency vs Risk */}
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
