import React from 'react';

export const ServiceStatusBadge = ({ name, status, details }) => {
  const isHealthy = status === 'CONNECTED' || status === 'UP' || status === 'ONLINE';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium">
      <span className="relative flex h-2 w-2">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isHealthy ? 'bg-emerald-400' : 'bg-rose-400'
          }`}
        ></span>
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isHealthy ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        ></span>
      </span>
      <span className="text-slate-300 font-semibold">{name}:</span>
      <span className={isHealthy ? 'text-emerald-400' : 'text-rose-400'}>
        {status}
      </span>
      {details && <span className="text-slate-500">({details})</span>}
    </div>
  );
};
