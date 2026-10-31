import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  RefreshCw,
  Loader2
} from 'lucide-react';
import { fetchOrders } from '../services/api';

export default function OrderMonitoring({
  orders: initialOrders = [],
  isLoading: isParentLoading = false,
  onSelectOrder,
  onNavigateTab,
  onRefresh: triggerParentRefresh
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [ordersList, setOrdersList] = useState(initialOrders);
  const [totalCount, setTotalCount] = useState(initialOrders.length);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Debounce search query input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Query orders directly from backend with active filters, search & pagination
  const loadOrdersFromBackend = useCallback(async () => {
    setIsLoadingOrders(true);
    setApiError(null);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage
      };

      if (statusFilter && statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (stageFilter && stageFilter !== 'ALL') {
        params.stage = stageFilter;
      }
      if (debouncedSearch && debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const res = await fetchOrders(params);

      if (res && res.data) {
        setOrdersList(res.data);
        setTotalCount(res.pagination?.total ?? res.data.length);
      }
    } catch (err) {
      console.error('Error fetching orders from backend:', err);
      setApiError(err.response?.data?.message || err.message || 'Failed to fetch orders from database');
      // Fallback to local filter if network error
      setOrdersList((prev) =>
        prev.filter((o) => {
          const matchStatus = statusFilter === 'ALL' || o.overallStatus === statusFilter;
          const matchStage = stageFilter === 'ALL' || o.currentStage === stageFilter;
          return matchStatus && matchStage;
        })
      );
    } finally {
      setIsLoadingOrders(false);
    }
  }, [currentPage, itemsPerPage, statusFilter, stageFilter, debouncedSearch]);

  // Re-fetch whenever filters, search, or page changes
  useEffect(() => {
    loadOrdersFromBackend();
  }, [loadOrdersFromBackend]);

  // Sync if parent triggers refresh or new orders arrive
  useEffect(() => {
    if (initialOrders.length > 0 && statusFilter === 'ALL' && stageFilter === 'ALL' && !debouncedSearch) {
      // Background update without resetting page if on page 1
      if (currentPage === 1) {
        loadOrdersFromBackend();
      }
    }
  }, [initialOrders, currentPage, statusFilter, stageFilter, debouncedSearch, loadOrdersFromBackend]);

  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

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
      case 'ESCALATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
            <AlertTriangle className="w-3 h-3 text-violet-500" />
            ESCALATED
          </span>
        );
      case 'STUCK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
            <Clock className="w-3 h-3 text-orange-500" />
            STUCK
          </span>
        );
      case 'PROCESSING':
      case 'IN_FLIGHT':
      case 'HEALING':
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
    if (order.overallStatus === 'FAILED' || order.overallStatus === 'REJECTED') {
      return { score: 95, label: 'HIGH', color: 'text-rose-600 bg-rose-50 border-rose-200' };
    }
    if (order.overallStatus === 'DELAYED' || order.overallStatus === 'ESCALATED') {
      return { score: 78, label: 'ELEVATED', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    }
    const ratio = (order.actualProcessingTimeMs || 1000) / (order.expectedCompletionTimeMs || order.expectedSlaMs || 2500);
    if (ratio > 0.8) {
      return { score: 62, label: 'MODERATE', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    }
    return { score: 14, label: 'LOW', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  };

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {apiError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{apiError}</span>
          </div>
          <button
            onClick={loadOrdersFromBackend}
            className="text-xs font-semibold underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order #, customer, plan, correlation ID..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
          />
          {isLoadingOrders && (
            <Loader2 className="w-3.5 h-3.5 text-cyan-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
          )}
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
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="ALL">All Orders</option>
              <option value="COMPLETED">Completed</option>
              <option value="PROCESSING">Processing</option>
              <option value="DELAYED">Delayed</option>
              <option value="FAILED">Failed</option>
              <option value="REJECTED">Rejected</option>
              <option value="ESCALATED">Escalated</option>
              <option value="STUCK">Stuck</option>
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
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="ALL">All Stages</option>
              <option value="CRM">1. CRM</option>
              <option value="ORDER_MANAGEMENT">2. OMS</option>
              <option value="INVENTORY">3. Inventory</option>
              <option value="PAYMENT">4. Payment</option>
              <option value="PROVISIONING">5. Provisioning</option>
              <option value="NOTIFICATION">6. Notification</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => {
              loadOrdersFromBackend();
              if (triggerParentRefresh) triggerParentRefresh();
            }}
            disabled={isLoadingOrders}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-colors disabled:opacity-50"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin text-cyan-600' : ''}`} />
          </button>

          {/* Total Counter Badge */}
          <span className="text-[11px] px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-mono font-medium">
            {totalCount} matching in DB
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
              {isLoadingOrders && ordersList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 text-cyan-600 animate-spin mx-auto mb-2" />
                    <p className="font-medium text-slate-600">Querying MongoDB Community Server...</p>
                  </td>
                </tr>
              ) : ordersList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <PackageSearch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-600">
                      No {statusFilter !== 'ALL' ? statusFilter : ''} orders found
                    </p>
                    <p className="text-[11px] mt-0.5 text-slate-400">
                      Try selecting a different status filter or generate a new order from the header.
                    </p>
                  </td>
                </tr>
              ) : (
                ordersList.map((order) => {
                  const risk = calculateRiskScore(order);
                  const hasFailure =
                    order.overallStatus === 'FAILED' ||
                    order.overallStatus === 'DELAYED' ||
                    order.overallStatus === 'REJECTED' ||
                    order.overallStatus === 'ESCALATED' ||
                    order.overallStatus === 'STUCK';

                  return (
                    <tr key={order._id || order.orderNumber} className="hover:bg-slate-50/80 transition-colors">
                      {/* Order ID */}
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-bold text-slate-900">{order.orderNumber}</div>
                        <div
                          className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-[130px]"
                          title={order.correlationId}
                        >
                          {order.correlationId || 'N/A'}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-800">{order.customer?.name || 'Customer'}</div>
                        <div className="text-[11px] text-slate-500">{order.plan?.planName || order.productType || 'Broadband Fiber'}</div>
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
                        <span className="text-[10px] text-slate-400 block">
                          SLA: {order.expectedCompletionTimeMs || order.expectedSlaMs || 2500}ms
                        </span>
                      </td>

                      {/* Failure Category */}
                      <td className="px-5 py-3.5">
                        {hasFailure ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-500" />
                            {order.failureDetails?.failureType ||
                              (order.scenario === 'API_ERROR'
                                ? 'API Response Error'
                                : order.scenario === 'DELAY'
                                ? 'Order Delay'
                                : order.scenario === 'REJECTION'
                                ? 'Order Rejection'
                                : 'Pipeline Fault')}
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
                            if (onSelectOrder) onSelectOrder(order);
                            onNavigateTab('details');
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors cursor-pointer"
                          title="View Full Stage Timeline"
                        >
                          Journey
                        </button>
                        <button
                          onClick={() => {
                            if (onSelectOrder) onSelectOrder(order);
                            onNavigateTab('twin');
                          }}
                          className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Run Digital Twin What-If"
                        >
                          <Cpu className="w-3 h-3 text-indigo-500" />
                          <span>Twin</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalCount > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <span>
              Showing {ordersList.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} orders (Page {currentPage} of {totalPages})
            </span>
            <div className="flex space-x-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoadingOrders}
                className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || isLoadingOrders}
                className="px-3 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
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
