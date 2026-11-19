import React, { useEffect } from 'react';
import { CheckCircle2, Sparkles, X, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ToastProps {
  message: string;
  type?: 'success' | 'info' | 'copilot';
  isOpen: boolean;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  isOpen,
  onClose,
  duration = 3200,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed z-[70] left-4 right-4 bottom-24 sm:left-auto sm:right-6 sm:bottom-6 flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface border border-border-subtle shadow-elevada anim-entrar sm:max-w-md">
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
        type === 'success' && "bg-emerald-500/20 text-emerald-700 border border-emerald-500/30",
        type === 'copilot' && "bg-accent-primary/20 text-accent-glow border border-accent-glow/40",
        type === 'info' && "bg-blue-500/20 text-blue-700 border border-blue-500/30"
      )}>
        {type === 'success' && <CheckCircle2 className="w-4 h-4" />}
        {type === 'copilot' && <Sparkles className="w-4 h-4" />}
        {type === 'info' && <Info className="w-4 h-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-text-main leading-snug">
          {message}
        </p>
      </div>

      <button
        onClick={onClose}
        className="w-6 h-6 rounded-lg bg-canvas/60 text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
