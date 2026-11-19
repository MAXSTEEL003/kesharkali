// src/components/StatCard.jsx
// Translucent Glassmorphic StatCard with Surrounding Glowing Outline & Frosted Glass Shimmer

import React from 'react';

export default function StatCard({ 
  label, 
  value, 
  subtext, 
  icon: Icon, 
  color = 'red', 
  alert = false, 
  onClick 
}) {
  const glowStyles = {
    gold: {
      card: 'glass-glow-gold bg-gradient-to-br from-white/55 via-white/35 to-amber-100/25',
      icon: 'bg-[#C69A3B]/15 text-[#C69A3B] border border-[#C69A3B]/40 shadow-[0_0_12px_rgba(198,154,59,0.3)]',
      value: 'text-[#252525]',
      accentDot: 'bg-[#C69A3B]'
    },
    red: {
      card: 'glass-glow-red bg-gradient-to-br from-white/55 via-white/35 to-rose-100/25',
      icon: 'bg-[#8F1717]/15 text-[#8F1717] border border-[#8F1717]/40 shadow-[0_0_12px_rgba(143,23,23,0.25)]',
      value: 'text-[#252525]',
      accentDot: 'bg-[#8F1717]'
    },
    burgundy: {
      card: 'glass-glow-burgundy bg-gradient-to-br from-white/55 via-white/35 to-red-100/25',
      icon: 'bg-[#5E1010]/15 text-[#5E1010] border border-[#5E1010]/40 shadow-[0_0_12px_rgba(94,16,16,0.25)]',
      value: 'text-[#252525]',
      accentDot: 'bg-[#5E1010]'
    },
    amber: {
      card: 'glass-glow-amber bg-gradient-to-br from-white/55 via-white/35 to-amber-100/30',
      icon: 'bg-amber-500/15 text-amber-600 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]',
      value: 'text-[#252525]',
      accentDot: 'bg-amber-500'
    },
    green: {
      card: 'glass-glow-green bg-gradient-to-br from-white/55 via-white/35 to-emerald-100/25',
      icon: 'bg-emerald-600/15 text-emerald-600 border border-emerald-600/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
      value: 'text-[#252525]',
      accentDot: 'bg-emerald-600'
    },
    gray: {
      card: 'glass-glow-gray bg-gradient-to-br from-white/55 via-white/35 to-slate-100/25',
      icon: 'bg-gray-200/70 text-gray-600 border border-gray-300 shadow-xs',
      value: 'text-[#252525]',
      accentDot: 'bg-gray-400'
    }
  };

  const style = glowStyles[color] || glowStyles.red;

  return (
    <div 
      onClick={onClick}
      className={`glass-card-base p-4 relative group ${style.card} ${
        onClick ? 'cursor-pointer' : ''
      } ${
        alert ? 'ring-2 ring-red-500/60 animate-pulse' : ''
      }`}
    >
      {/* Top ambient glass reflection highlight */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none" />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#666666] flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${style.accentDot}`} />
          {label}
        </span>
        {Icon && (
          <div className={`p-1.5 rounded-lg backdrop-blur-md transition-transform duration-200 group-hover:scale-110 ${style.icon}`}>
            <Icon size={15} />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-2xl font-bold tracking-tight ${style.value} tabular-nums font-['Plus_Jakarta_Sans',sans-serif]`}>
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
