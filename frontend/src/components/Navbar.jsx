import React from 'react';
import { ShieldAlert, Activity, RefreshCw } from 'lucide-react';
import { ServiceStatusBadge } from './ServiceStatusBadge';

export const Navbar = ({ healthData, socketConnected, onRefreshHealth, isRefreshing }) => {
  const backendStatus = healthData ? healthData.status : 'DISCONNECTED';
  const dbStatus = healthData?.dependencies?.database?.status || 'DISCONNECTED';
  const aiStatus = healthData?.dependencies?.aiEngine?.status || 'DISCONNECTED';

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              OrderFlow Sentinel
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                Self-Healing AI
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Telecom Broadband Pipeline & Predictive Digital Twin
            </p>
          </div>
        </div>

        {/* Live Service Status Indicators */}
        <div className="flex flex-wrap items-center gap-2.5">
          <ServiceStatusBadge name="Gateway" status={backendStatus} />
          <ServiceStatusBadge name="MongoDB" status={dbStatus} />
          <ServiceStatusBadge name="AI Engine" status={aiStatus} />
          <ServiceStatusBadge
            name="WebSocket"
            status={socketConnected ? 'ONLINE' : 'DISCONNECTED'}
          />

          <button
            onClick={onRefreshHealth}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            title="Refresh System Health Status"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
