// src/components/StatCard.jsx
import React from 'react';

export default function StatCard({ label, value, subtext, icon: Icon, color = 'red', alert = false, onClick }) {
  const colorStyles = {
    red: 'border-l-4 border-l-[#8F1717] bg-white text-[#252525]',
    burgundy: 'border-l-4 border-l-[#5E1010] bg-white text-[#252525]',
    gold: 'border-l-4 border-l-[#C69A3B] bg-white text-[#252525]',
    amber: 'border-l-4 border-l-amber-500 bg-amber-50/50 text-[#252525]',
    green: 'border-l-4 border-l-emerald-600 bg-emerald-50/30 text-[#252525]',
    gray: 'border-l-4 border-l-gray-400 bg-white text-[#252525]'
  };

  return (
    <div 
      onClick={onClick}
      className={`rounded-lg border border-[#E8E2DC] p-3.5 shadow-xs transition-all duration-150 ${colorStyles[color] || colorStyles.red} ${onClick ? 'cursor-pointer hover:shadow-md hover:border-[#C69A3B]' : ''} ${alert ? 'ring-2 ring-red-400/50 animate-pulse' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#777777]">{label}</span>
        {Icon && (
          <div className="p-1 rounded bg-[#FAF9F6] text-[#8F1717]">
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-bold tracking-tight text-[#252525] tabular-nums font-['Space_Grotesk',sans-serif]">
          {value}
        </span>
      </div>
      {subtext && (
        <p className="mt-1 text-[11px] text-[#777777] truncate flex items-center gap-1">
          {subtext}
        </p>
      )}
    </div>
  );
}

