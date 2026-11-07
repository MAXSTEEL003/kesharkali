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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className={`bg-white rounded-lg shadow-2xl border border-[#E8E2DC] w-full ${maxWidth} overflow-hidden transform transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#8F1717] px-6 py-4 flex items-center justify-between border-b-2 border-[#C69A3B]">
          <div>
            <h3 className="text-white text-base font-semibold tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#C69A3B]"></span>
              {title}
            </h3>
            {subtitle && <p className="text-white/80 text-xs mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6 max-h-[85vh] overflow-y-auto bg-[#FAF9F6]">
          {children}
        </div>
      </div>
    </div>
  );
}
