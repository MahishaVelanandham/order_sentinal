import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  PackageSearch,
  ArrowUpDown,
  ExternalLink,
  Cpu,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw
} from 'lucide-react';

export default function OrderMonitoring({
  orders = [],
  isLoading = false,
  onSelectOrder,
  onNavigateTab,
  onRefresh
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        order.orderNumber?.toLowerCase().includes(q) ||
        order.customer?.name?.toLowerCase().includes(q) ||
        order.correlationId?.toLowerCase().includes(q) ||
        order.product?.planName?.toLowerCase().includes(q);

      // Status
      const matchStatus = statusFilter === 'ALL' || order.overallStatus === statusFilter;

      // Stage
      const matchStage = stageFilter === 'ALL' || order.currentStage === stageFilter;

      return matchSearch && matchStatus && matchStage;
    });
  }, [orders, searchQuery, statusFilter, stageFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            COMPLETED
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-500" />
            FAILED
          </span>
        );
      case 'DELAYED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-500" />
            DELAYED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <AlertTriangle className="w-3 h-3 text-purple-500" />
            REJECTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
            <RefreshCw className="w-3 h-3 text-cyan-500 animate-spin" />
            {status || 'IN_FLIGHT'}
          </span>
        );
    }
  };

  const calculateRiskScore = (order) => {
    if (order.overallStatus === 'FAILED' || order.overallStatus === 'REJECTED') return { score: 95, label: 'HIGH', color: 'text-rose-600 bg-rose-50 border-rose-200' };
    if (order.overallStatus === 'DELAYED') return { score: 78, label: 'ELEVATED', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    const ratio = (order.actualProcessingTimeMs || 1000) / (order.expectedSlaMs || 3500);
    if (ratio > 0.8) return { score: 62, label: 'MODERATE', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { score: 14, label: 'LOW', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search order #, customer, correlation ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="DELAYED">Delayed</option>
              <option value="REJECTED">Rejected</option>
              <option value="IN_FLIGHT">In-Flight</option>
            </select>
          </div>

          {/* Stage Filter */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Stage:</span>
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="ALL">All Stages</option>
              <option value="CRM">1. CRM</option>
              <option value="OMS">2. OMS</option>
              <option value="INVENTORY">3. Inventory</option>
              <option value="PAYMENT">4. Payment</option>
              <option value="PROVISIONING">5. Provisioning</option>
              <option value="NOTIFICATION">6. Notification</option>
            </select>
          </div>

          {/* Total Counter Badge */}
          <span className="text-[11px] px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md font-mono">
            {filteredOrders.length} records
          </span>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Order ID & Correlation</th>
                <th className="px-5 py-3.5">Customer / Broadband Plan</th>
                <th className="px-5 py-3.5">Current Stage</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Processing Time</th>
                <th className="px-5 py-3.5">Failure Category</th>
                <th className="px-5 py-3.5">Risk Score</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedOrders.map((order) => {
                const risk = calculateRiskScore(order);
                const hasFailure = order.overallStatus === 'FAILED' || order.overallStatus === 'DELAYED' || order.overallStatus === 'REJECTED';

                return (
                  <tr key={order._id || order.orderNumber} className="hover:bg-slate-50/80 transition-colors">
                    {/* Order ID */}
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-bold text-slate-900">{order.orderNumber}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-[130px]" title={order.correlationId}>
                        {order.correlationId || 'N/A'}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-800">{order.customer?.name || 'Customer'}</div>
                      <div className="text-[11px] text-slate-500">{order.product?.planName || 'Broadband'}</div>
                    </td>

                    {/* Current Stage */}
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-mono font-medium text-[11px] border border-slate-200">
                        {order.currentStage}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">{getStatusBadge(order.overallStatus)}</td>

                    {/* Processing Time */}
                    <td className="px-5 py-3.5 font-mono">
                      <span className="font-semibold text-slate-800">{order.actualProcessingTimeMs || 0}ms</span>
                      <span className="text-[10px] text-slate-400 block">SLA: {order.expectedSlaMs || 3500}ms</span>
                    </td>

                    {/* Failure Category */}
                    <td className="px-5 py-3.5">
                      {hasFailure ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          {order.scenario === 'API_ERROR' ? 'API Response Error' : order.scenario === 'DELAY' ? 'Order Delay' : order.scenario === 'REJECTION' ? 'Order Rejection' : 'Pipeline Fault'}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-mono">None (Healthy)</span>
                      )}
                    </td>

                    {/* Risk Score */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${risk.color}`}>
                        {risk.score}% {risk.label}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td className="px-5 py-3.5 text-right space-x-1">
                      <button
                        onClick={() => {
                          onSelectOrder(order);
                          onNavigateTab('details');
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
                        title="View Full Stage Timeline"
                      >
                        Journey
                      </button>
                      <button
                        onClick={() => {
                          onSelectOrder(order);
                          onNavigateTab('twin');
                        }}
                        className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-[11px] transition-colors inline-flex items-center gap-1"
                        title="Run Digital Twin What-If"
                      >
                        <Cpu className="w-3 h-3 text-indigo-500" />
                        <span>Twin</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {paginatedOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                    <PackageSearch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-600">No matching orders found</p>
                    <p className="text-[11px] mt-0.5">Try adjusting your search terms or generate a new simulated order.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredOrders.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
            </span>
            <div className="flex space-x-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
