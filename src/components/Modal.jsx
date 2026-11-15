// src/components/Modal.jsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, subtitle, children, maxWidth = 'max-w-2xl' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
      <div 
        className={`glass-modal rounded-2xl w-full ${maxWidth} overflow-hidden transform transition-all duration-200 border border-white/80 shadow-[0_25px_60px_rgba(0,0,0,0.2)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#8F1717]/95 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b-2 border-[#C69A3B]">
          <div>
            <h3 className="text-white text-base font-semibold tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#C69A3B] shadow-[0_0_8px_#C69A3B]"></span>
              {title}
            </h3>
            {subtitle && <p className="text-white/80 text-xs mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 max-h-[85vh] overflow-y-auto bg-white/65 backdrop-blur-lg">
          {children}
        </div>
      </div>
    </div>
  );
}

