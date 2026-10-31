import React from 'react';
import {
  LayoutDashboard,
  PackageSearch,
  Workflow,
  AlertTriangle,
  Cpu,
  HeartHandshake,
  FileText,
  Shield,
  Radio,
  ExternalLink
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, incidentCount = 0, pendingResolutions = 0 }) {
  const navItems = [
    {
      id: 'overview',
      label: 'Overview Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'monitoring',
      label: 'Order Monitoring',
      icon: PackageSearch,
      badge: null
    },
    {
      id: 'details',
      label: 'Order Details Journey',
      icon: Workflow,
      badge: null
    },
    {
      id: 'failure',
      label: 'Failure Analysis & RCA',
      icon: AlertTriangle,
      badge: incidentCount > 0 ? incidentCount : null,
      badgeColor: 'bg-rose-500 text-white'
    },
    {
      id: 'twin',
      label: 'Predictive Digital Twin',
      icon: Cpu,
      badge: 'AI ML',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
    },
    {
      id: 'resolutions',
      label: 'Resolution Centre',
      icon: HeartHandshake,
      badge: pendingResolutions > 0 ? pendingResolutions : null,
      badgeColor: 'bg-amber-500 text-slate-900 font-bold'
    },
    {
      id: 'audit',
      label: 'Audit Logs',
      icon: FileText,
      badge: null
    }
  ];

  return (
    <aside className="w-64 bg-[#0a0f1d] border-r border-slate-800 flex flex-col shrink-0 select-none text-slate-300 h-screen sticky top-0">
      {/* Brand & Logo Header */}
      <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-900/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              OrderFlow <span className="text-cyan-400 font-extrabold">Sentinel</span>
            </h1>
            <p className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">Self-Healing AI Ops</p>
          </div>
        </div>
      </div>

      {/* Domain Context Tag */}
      <div className="px-4 py-3 mx-3 my-2 rounded-md bg-slate-900/80 border border-slate-800/80">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 font-medium text-slate-300">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            Telecom Broadband
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
            6-Stage
          </span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          CRM → OMS → Inventory → Payment → Provisioning → Notification
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold px-3 py-1">
          Operations & Intelligence
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-900/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    item.badgeColor || 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Engine Status Card in Footer */}
      <div className="p-3 border-t border-slate-800 bg-[#070b16]">
        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Sentinel Sentinel Twin
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">ONLINE</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
            <span>FastAPI ML Engine</span>
            <span className="text-cyan-300 font-mono">Port 8000</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Node.js Gateway</span>
            <span className="text-indigo-300 font-mono">Port 5000</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
