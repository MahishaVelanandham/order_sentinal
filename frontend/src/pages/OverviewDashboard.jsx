import React, { useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Zap,
  TrendingUp,
  Cpu,
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';

export default function OverviewDashboard({
  orders = [],
  summary = {},
  incidents = [],
  twinPredictions = [],
  onSelectOrder,
  onNavigateTab,
  onGenerateScenario
}) {
  // Aggregate Metrics
  const totalOrders = summary.TOTAL || orders.length || 0;
  const completedOrders = summary.COMPLETED || orders.filter((o) => o.overallStatus === 'COMPLETED').length;
  const failedOrders = summary.FAILED || orders.filter((o) => o.overallStatus === 'FAILED').length;
  const delayedOrders = summary.DELAYED || orders.filter((o) => o.overallStatus === 'DELAYED').length;
  const rejectedOrders = summary.REJECTED || orders.filter((o) => o.overallStatus === 'REJECTED').length;
  
  // Auto-resolved count from incidents/orders
  const autoResolvedOrders = useMemo(() => {
    return incidents.filter((i) => i.resolutionStatus === 'AUTO_RESOLVED' || i.resolutionStatus === 'RESOLVED').length;
  }, [incidents]);

  // SLA breach risk calculation
  const slaBreachRiskPercent = useMemo(() => {
    if (!orders.length) return 0;
    const atRisk = orders.filter((o) => (o.actualProcessingTimeMs || 0) > (o.expectedSlaMs || 5000) * 0.8 || o.overallStatus === 'DELAYED').length;
    return Math.round((atRisk / orders.length) * 100);
  }, [orders]);

  // Chart 1: Status Distribution
  const statusPieData = useMemo(() => {
    return [
      { name: 'Completed', value: completedOrders, color: '#10b981' },
      { name: 'Failed', value: failedOrders, color: '#ef4444' },
      { name: 'Delayed', value: delayedOrders, color: '#f59e0b' },
      { name: 'Rejected', value: rejectedOrders, color: '#8b5cf6' },
      { name: 'In-Flight', value: Math.max(0, totalOrders - completedOrders - failedOrders - delayedOrders - rejectedOrders), color: '#06b6d4' }
    ].filter((item) => item.value > 0);
  }, [completedOrders, failedOrders, delayedOrders, rejectedOrders, totalOrders]);

  // Chart 2: Processing Duration Across Stages
  const stageLatencyData = [
    { stage: 'CRM', avgMs: 240, slaLimit: 500 },
    { stage: 'OMS', avgMs: 310, slaLimit: 600 },
    { stage: 'Inventory', avgMs: 580, slaLimit: 800 },
    { stage: 'Payment', avgMs: 720, slaLimit: 1000 },
    { stage: 'Provisioning', avgMs: 1450, slaLimit: 2000 },
    { stage: 'Notification', avgMs: 180, slaLimit: 400 }
  ];

  // Chart 3: Recent Order Latency Trend
  const latencyTrendData = useMemo(() => {
    if (!orders.length) return [];
    return orders.slice(0, 10).reverse().map((o, idx) => ({
      name: `#${o.orderNumber?.slice(-4) || idx + 1}`,
      latency: o.actualProcessingTimeMs || 1500,
      sla: o.expectedSlaMs || 3500
    }));
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Offline Fallback Banner */}
      {!orders.length && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-xs animate-fadeIn">
          <div className="flex items-center space-x-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>OFFLINE DEMONSTRATION MODE – Backend data unavailable.</span>
          </div>
          <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
            Synthetic Baseline Metrics
          </span>
        </div>
      )}

      {/* 7 Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Orders */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Orders</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-800">{totalOrders}</div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">Synthetic pipeline</div>
          </div>
        </div>

        {/* Successful Orders */}
        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Successful</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-700">{completedOrders}</div>
            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
              {totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0}% success rate
            </div>
          </div>
        </div>

        {/* Failed Orders */}
        <div className="bg-white p-3.5 rounded-xl border border-rose-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Failed</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-rose-700">{failedOrders}</div>
            <div className="text-[10px] text-rose-600 font-medium mt-0.5">API / Gateway errors</div>
          </div>
        </div>

        {/* Delayed Orders */}
        <div className="bg-white p-3.5 rounded-xl border border-amber-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Delayed</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-amber-700">{delayedOrders}</div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">SLA exceeded / slow</div>
          </div>
        </div>

        {/* Rejected Orders */}
        <div className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Rejected</span>
            <AlertTriangle className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-purple-700">{rejectedOrders}</div>
            <div className="text-[10px] text-purple-600 font-medium mt-0.5">Validation / Address</div>
          </div>
        </div>

        {/* Auto-Resolved Orders */}
        <div className="bg-white p-3.5 rounded-xl border border-cyan-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-cyan-600">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Auto-Resolved</span>
            <ShieldCheck className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-cyan-700">{autoResolvedOrders}</div>
            <div className="text-[10px] text-cyan-600 font-medium mt-0.5">Self-healing actions</div>
          </div>
        </div>

        {/* SLA Breach Risk */}
        <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-600">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Breach Risk</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-indigo-700">{slaBreachRiskPercent}%</div>
            <div className="text-[10px] text-indigo-600 font-medium mt-0.5">Digital Twin risk</div>
          </div>
        </div>
      </div>

      {/* Quick Scenario Dispatch Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            Simulate Broadband Pipeline Scenarios
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Instantly inject simulated order flows to evaluate Failure Detection, RCA, and Digital Twin
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onGenerateScenario('SUCCESS')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
          >
            + Golden Path (Success)
          </button>
          <button
            onClick={() => onGenerateScenario('API_ERROR')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
          >
            + 504 Timeout Error
          </button>
          <button
            onClick={() => onGenerateScenario('DELAY')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
          >
            + SLA Breach Delay
          </button>
          <button
            onClick={() => onGenerateScenario('REJECTION')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
          >
            + Address Rejection
          </button>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: Order Status Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Order Status Breakdown</h4>
              <p className="text-[11px] text-slate-400">Distribution across simulated pipeline</p>
            </div>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-56">
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No order data available yet
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Stage Latencies */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Stage Latency vs SLA Limit</h4>
              <p className="text-[11px] text-slate-400">Baseline telecom stage SLA benchmarks (Reference Matrix)</p>
            </div>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageLatencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="stage" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} unit="ms" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="avgMs" name="Avg Latency" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="slaLimit" name="SLA Limit" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Latency Trend vs SLA */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Order Latency vs Max SLA</h4>
              <p className="text-[11px] text-slate-400">Live duration trend of recent orders</p>
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <div className="h-56">
            {latencyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latencyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} unit="ms" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="latency" name="Actual Duration" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#latencyGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No recent order latency data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Recent Orders Feed */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent In-Flight & Completed Orders</h3>
            <p className="text-[11px] text-slate-500">Live feed from the 6-stage simulated pipeline</p>
          </div>
          <button
            onClick={() => onNavigateTab('monitoring')}
            className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
          >
            <span>View All in Monitoring</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3">Order Number</th>
                <th className="px-5 py-3">Customer / Product</th>
                <th className="px-5 py-3">Current Stage</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Duration / SLA</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {orders.slice(0, 5).map((order) => {
                const statusColors = {
                  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
                  DELAYED: 'bg-amber-50 text-amber-700 border-amber-200',
                  REJECTED: 'bg-purple-50 text-purple-700 border-purple-200',
                  IN_FLIGHT: 'bg-cyan-50 text-cyan-700 border-cyan-200'
                };
                const badgeClass = statusColors[order.overallStatus] || 'bg-slate-100 text-slate-700 border-slate-200';

                return (
                  <tr key={order._id || order.orderNumber} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3 font-mono font-semibold text-slate-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{order.customer?.name || 'Broadband Customer'}</div>
                      <div className="text-[11px] text-slate-400">{order.product?.planName || 'Fiber 300 Mbps'}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px]">
                        {order.currentStage}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClass}`}>
                        {order.overallStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600">
                      {order.actualProcessingTimeMs || 0}ms <span className="text-slate-400">/ {order.expectedSlaMs || 3500}ms</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          onSelectOrder(order);
                          onNavigateTab('details');
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
                      >
                        Journey
                      </button>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No orders in pipeline. Click "Simulate Order" above to generate synthetic broadband traffic.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
