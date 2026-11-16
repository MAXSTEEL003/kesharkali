// src/context/NotificationContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X, HelpCircle } from 'lucide-react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [alertDialog, setAlertDialog] = useState(null);

  // Toast notification dispatcher
  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Promise-based confirm dialog replacing window.confirm
  const confirm = useCallback(({
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'danger'
  }) => {
    return new Promise((resolve) => {
      setConfirmDialog({
        title,
        message,
        confirmText,
        cancelText,
        type,
        onConfirm: () => {
          setConfirmDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(null);
          resolve(false);
        }
      });
    });
  }, []);

  // In-app alert dialog replacing window.alert
  const showAlert = useCallback(({
    title = 'Notice',
    message,
    buttonText = 'Understood',
    type = 'info'
  }) => {
    return new Promise((resolve) => {
      setAlertDialog({
        title,
        message,
        buttonText,
        type,
        onClose: () => {
          setAlertDialog(null);
          resolve();
        }
      });
    });
  }, []);

  // Expose global fallbacks for legacy or utility callbacks
  useEffect(() => {
    window.__showToast = showToast;
    window.__confirm = confirm;
    window.__alert = showAlert;
  }, [showToast, confirm, showAlert]);

  return (
    <NotificationContext.Provider value={{ showToast, confirm, showAlert }}>
      {children}

      {/* Floating Glassmorphic Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-3">
        {toasts.map(toast => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-top-2 ${
                isSuccess
                  ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100 shadow-emerald-950/40'
                  : isError
                  ? 'bg-rose-950/90 border-rose-500/40 text-rose-100 shadow-rose-950/40'
                  : isWarning
                  ? 'bg-amber-950/90 border-amber-500/40 text-amber-100 shadow-amber-950/40'
                  : 'bg-stone-900/90 border-[#C69A3B]/40 text-amber-100 shadow-stone-950/40'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 size={17} className="text-emerald-400" />}
                {isError && <XCircle size={17} className="text-rose-400" />}
                {isWarning && <AlertTriangle size={17} className="text-amber-400" />}
                {!isSuccess && !isError && !isWarning && <Info size={17} className="text-[#C69A3B]" />}
              </div>
              <div className="flex-1 text-xs leading-relaxed font-medium">
                {toast.message}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-white/50 hover:text-white p-0.5 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* In-Webapp Confirm Dialog (replaces window.confirm) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div 
            className="w-full max-w-md bg-[#FAF9F6] rounded-2xl overflow-hidden border border-[#C69A3B]/40 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-[#8F1717] to-[#5E1010] p-4 text-white flex items-center justify-between border-b-2 border-[#C69A3B]">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-[#C69A3B]" />
                <h3 className="font-bold text-sm tracking-wide font-['Space_Grotesk']">{confirmDialog.title}</h3>
              </div>
              <button
                onClick={confirmDialog.onCancel}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 text-xs text-[#252525] space-y-4">
              <p className="leading-relaxed font-medium">{confirmDialog.message}</p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E8E2DC]">
                <button
                  type="button"
                  onClick={confirmDialog.onCancel}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  {confirmDialog.cancelText}
                </button>
                <button
                  type="button"
                  onClick={confirmDialog.onConfirm}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all cursor-pointer ${
                    confirmDialog.type === 'danger'
                      ? 'bg-rose-700 hover:bg-rose-800'
                      : 'bg-[#8F1717] hover:bg-[#771212]'
                  }`}
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-Webapp Alert Dialog (replaces window.alert) */}
      {alertDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div 
            className="w-full max-w-md bg-[#FAF9F6] rounded-2xl overflow-hidden border border-[#C69A3B]/40 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-[#8F1717] to-[#5E1010] p-4 text-white flex items-center justify-between border-b-2 border-[#C69A3B]">
              <div className="flex items-center gap-2">
                {alertDialog.type === 'error' ? (
                  <XCircle size={18} className="text-rose-300" />
                ) : (
                  <Info size={18} className="text-[#C69A3B]" />
                )}
                <h3 className="font-bold text-sm tracking-wide font-['Space_Grotesk']">{alertDialog.title}</h3>
              </div>
              <button
                onClick={alertDialog.onClose}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 text-xs text-[#252525] space-y-4">
              <p className="leading-relaxed font-medium whitespace-pre-wrap">{alertDialog.message}</p>

              <div className="flex items-center justify-end pt-2 border-t border-[#E8E2DC]">
                <button
                  type="button"
                  onClick={alertDialog.onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#8F1717] hover:bg-[#771212] transition-colors cursor-pointer"
                >
                  {alertDialog.buttonText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    // Graceful fallback if called outside provider
    return {
      showToast: (msg) => { if (window.__showToast) window.__showToast(msg); else console.log(msg); },
      confirm: (opts) => { if (window.__confirm) return window.__confirm(opts); return Promise.resolve(window.confirm(opts.message)); },
      showAlert: (opts) => { if (window.__alert) return window.__alert(opts); window.alert(opts.message); return Promise.resolve(); }
    };
  }
  return context;
}
