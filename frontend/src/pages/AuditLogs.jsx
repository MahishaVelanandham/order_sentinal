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
  Bot
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
    fetchResolutionHistory()
      .then((res) => {
        setLogs(res.data || res.history || []);
        setIsOfflineMode(false);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('Could not fetch audit history:', err);
        setIsOfflineMode(true);
        // Fallback synthetic audit items if empty
        setLogs([
          {
            actionId: 'ACT-ORD-88219-01',
            orderNumber: 'ORD-88219',
            correlationId: 'CORR-88219-PROV',
            actionType: 'RETRY_WITH_EXPONENTIAL_BACKOFF',
            riskTier: 'LOW_RISK',
            initiatedBy: 'AUTONOMOUS_SENTINEL_AI',
            status: 'SUCCESS',
            idempotencyKey: 'IDEMP-ORD-88219-RETRY-1',
            summary: 'OLT Provisioning Gateway retried after 500ms backoff. HTTP 200 received.',
            timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString()
          },
          {
            actionId: 'ACT-ORD-91042-02',
            orderNumber: 'ORD-91042',
            correlationId: 'CORR-91042-AUTH',
            actionType: 'SIMULATED_TOKEN_REFRESH',
            riskTier: 'LOW_RISK',
            initiatedBy: 'AUTONOMOUS_SENTINEL_AI',
            status: 'SUCCESS',
            idempotencyKey: 'IDEMP-ORD-91042-AUTH-1',
            summary: 'CRM Auth Token expired (401). Generated synthetic refresh token and resumed stage.',
            timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString()
          },
          {
            actionId: 'ACT-ORD-77190-03',
            orderNumber: 'ORD-77190',
            correlationId: 'CORR-77190-VALID',
            actionType: 'HUMAN_OPERATOR_ESCALATION',
            riskTier: 'HIGH_RISK',
            initiatedBy: 'OPERATOR_DISPATCH',
            status: 'PENDING_REVIEW',
            idempotencyKey: 'IDEMP-ORD-77190-ESC-1',
            summary: 'Address validation failed. Building outside fiber footprint. Escalated to Tier-2.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString()
          }
        ]);
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
        log.summary?.toLowerCase().includes(q);

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
            <span>OFFLINE DEMONSTRATION MODE – Backend data unavailable.</span>
          </div>
          <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
            Simulated Audit Records
          </span>
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
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="ALL">All Outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="FAILED">Failed</option>
          </select>

          <button
            onClick={loadAuditHistory}
            disabled={isLoading}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 transition-colors disabled:opacity-50"
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
                const isAuto = log.initiatedBy?.includes('AUTONOMOUS') || log.initiatedBy?.includes('AI');

                return (
                  <tr key={log.actionId || idx} className="hover:bg-slate-50/80 transition-colors">
                    {/* Timestamp */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp || Date.now()).toLocaleTimeString()}{' '}
                      <span className="text-slate-400 block text-[10px]">
                        {new Date(log.timestamp || Date.now()).toLocaleDateString()}
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
                        {log.actionType || log.remediationAction || 'EXPONENTIAL_BACKOFF_RETRY'}
                      </span>
                    </td>

                    {/* Initiator */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {isAuto ? (
                          <>
                            <Bot className="w-3.5 h-3.5 text-cyan-600" />
                            Autonomous AI
                          </>
                        ) : (
                          <>
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                            Operator
                          </>
                        )}
                      </span>
                    </td>

                    {/* Risk Tier */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          log.riskTier === 'LOW_RISK'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {log.riskTier || 'LOW_RISK'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          log.status === 'SUCCESS' || log.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {log.status === 'SUCCESS' || log.status === 'RESOLVED' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ) : log.status === 'FAILED' ? (
                          <XCircle className="w-3 h-3 text-rose-600" />
                        ) : (
                          <Clock className="w-3 h-3 text-purple-600" />
                        )}
                        {log.status}
                      </span>
                    </td>

                    {/* Idempotency & Summary */}
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="text-[11px] text-slate-700 font-medium truncate" title={log.summary || log.message}>
                        {log.summary || log.message || 'Operation executed safely.'}
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
                    <p className="font-medium text-slate-600">No audit records found</p>
                    <p className="text-[11px] mt-0.5">Remediation actions taken in the Resolution Centre will appear here.</p>
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
