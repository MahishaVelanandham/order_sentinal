import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Filter,
  User,
  Bot,
  AlertTriangle
} from 'lucide-react';
import { fetchResolutionHistory } from '../services/api';

export default function AuditLogs({ onRefresh }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const loadAuditHistory = () => {
    setIsLoading(true);
    fetchResolutionHistory({ limit: 100 })
      .then((res) => {
        setLogs(res.data || res.history || []);
        setIsOfflineMode(false);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('Could not fetch audit history:', err);
        setIsOfflineMode(true);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadAuditHistory();
  }, []);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        log.orderNumber?.toLowerCase().includes(q) ||
        log.actionId?.toLowerCase().includes(q) ||
        log.actionType?.toLowerCase().includes(q) ||
        log.idempotencyKey?.toLowerCase().includes(q) ||
        log.decisionReason?.toLowerCase().includes(q) ||
        log.executionResult?.responseSummary?.toLowerCase().includes(q);

      const matchStatus = statusFilter === 'ALL' || log.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [logs, searchQuery, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Offline Demonstration Banner */}
      {isOfflineMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-xs animate-fadeIn">
          <div className="flex items-center space-x-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>OFFLINE DEMONSTRATION MODE – Backend audit log service unavailable.</span>
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action ID, order #, idempotency key..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filter and Refresh */}
        <div className="flex items-center space-x-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Statuses ({logs.length})</option>
            <option value="COMPLETED">Completed / Healed</option>
            <option value="RECOMMENDED">Recommended</option>
            <option value="APPROVED">Approved</option>
            <option value="ESCALATED">Escalated</option>
            <option value="REJECTED">Rejected</option>
            <option value="FAILED">Failed</option>
          </select>

          <button
            onClick={() => {
              loadAuditHistory();
              if (onRefresh) onRefresh();
            }}
            disabled={isLoading}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Action ID / Order</th>
                <th className="px-5 py-3.5">Remediation Policy</th>
                <th className="px-5 py-3.5">Initiator</th>
                <th className="px-5 py-3.5">Risk Tier</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Idempotency & Execution Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.map((log, idx) => {
                const logTime = log.performedAt || log.createdAt || log.timestamp || Date.now();
                const isAuto =
                  log.requiresHumanApproval === false &&
                  !log.actionType?.includes('MANUAL') &&
                  log.actionType !== 'ESCALATE_HUMAN_OPERATOR';

                const summaryText =
                  log.executionResult?.responseSummary ||
                  log.decisionReason ||
                  log.summary ||
                  log.message ||
                  'Remediation action registered in audit log.';

                return (
                  <tr key={log.actionId || log._id || idx} className="hover:bg-slate-50/80 transition-colors">
                    {/* Timestamp */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(logTime).toLocaleTimeString()}{' '}
                      <span className="text-slate-400 block text-[10px]">
                        {new Date(logTime).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Action ID / Order */}
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-bold text-slate-900">{log.orderNumber}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">{log.actionId}</div>
                    </td>

                    {/* Remediation Policy */}
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-slate-800 text-[11px]">
                        {log.actionType || 'EXPONENTIAL_RETRY'}
                      </span>
                    </td>

                    {/* Initiator */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {isAuto ? (
                          <>
                            <Bot className="w-3.5 h-3.5 text-cyan-600" />
                            Autonomous Sentinel AI
                          </>
                        ) : (
                          <>
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                            Operator Dispatch
                          </>
                        )}
                      </span>
                    </td>

                    {/* Risk Tier */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          log.riskTier === 'LOW_RISK' || log.riskTier === 'LOW'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : log.riskTier === 'MEDIUM_RISK' || log.riskTier === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {log.riskTier || 'LOW_RISK'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          log.status === 'COMPLETED' || log.status === 'SUCCESS' || log.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : log.status === 'ESCALATED' || log.status === 'REJECTED'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {log.status === 'COMPLETED' || log.status === 'SUCCESS' || log.status === 'RESOLVED' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : log.status === 'FAILED' ? (
                          <XCircle className="w-3 h-3 text-rose-600" />
                        ) : (
                          <Clock className="w-3 h-3 text-amber-600" />
                        )}
                        {log.status}
                      </span>
                    </td>

                    {/* Idempotency & Summary */}
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="text-[11px] text-slate-700 font-medium truncate" title={summaryText}>
                        {summaryText}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate" title={log.idempotencyKey}>
                        Key: {log.idempotencyKey || 'IDEMP-SENTINEL-DEF'}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-600">No audit records match your criteria</p>
                    <p className="text-[11px] mt-0.5">Execute resolutions in the Resolution Centre to register new immutable actions.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>
            Showing {filteredLogs.length} of {logs.length} logged remediation events
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Cryptographic Idempotency Guard Active
          </span>
        </div>
      </div>
    </div>
  );
}
