/**
 * ProgressLoader Component
 * Multi-step animated loading overlay shown during OCR processing
 * Displays progress stages: Uploading → Extracting → Verifying → Preparing
 * Properly dismisses on both success and failure.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineExclamationCircle, HiOutlineRefresh } from 'react-icons/hi';

const STAGES = [
  { label: 'Uploading documents...', icon: '📤' },
  { label: 'Extracting passport text...', icon: '🔍' },
  { label: 'Verifying details with AI...', icon: '🤖' },
  { label: 'Preparing your form...', icon: '✨' },
];

export default function ProgressLoader({ isActive, errorMessage, onRetry, onDismiss }) {
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showError, setShowError] = useState(false);
  const intervalRef = useRef(null);

  // Drive progress animation while active
  useEffect(() => {
    if (isActive) {
      setShowError(false);
      setProgress(0);
      setCurrentStage(0);

      let stageIndex = 0;
      let progressVal = 0;

      intervalRef.current = setInterval(() => {
        progressVal += 0.6;

        if (progressVal >= 25 && stageIndex === 0) stageIndex = 1;
        if (progressVal >= 55 && stageIndex === 1) stageIndex = 2;
        if (progressVal >= 80 && stageIndex === 2) stageIndex = 3;
        if (progressVal > 92) progressVal = 92; // Cap at 92%

        setCurrentStage(stageIndex);
        setProgress(progressVal);
      }, 250);

      return () => clearInterval(intervalRef.current);
    } else {
      // Processing stopped
      clearInterval(intervalRef.current);

      if (errorMessage) {
        // Show error state
        setShowError(true);
      } else if (progress > 0) {
        // Success — briefly show 100% then auto-dismiss
        setProgress(100);
        setCurrentStage(STAGES.length - 1);
        const timer = setTimeout(() => {
          setProgress(0);
          setCurrentStage(0);
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [isActive, errorMessage]);

  // Don't render when fully dismissed
  const isVisible = isActive || showError || progress > 0;
  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(2, 6, 23, 0.88)', backdropFilter: 'blur(12px)' }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-card p-8 max-w-sm w-full mx-4 text-center"
          >
            {showError ? (
              /* ─── Error State ─── */
              <>
                <motion.div
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-5"
                >
                  <HiOutlineExclamationCircle className="w-8 h-8 text-red-400" />
                </motion.div>

                <h3 className="text-lg font-semibold text-white mb-2">
                  Processing Failed
                </h3>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                  {errorMessage || 'Something went wrong while processing your documents.'}
                </p>

                <div className="flex gap-3 justify-center">
                  {onRetry && (
                    <button
                      onClick={() => {
                        setShowError(false);
                        setProgress(0);
                        onRetry();
                      }}
                      className="btn-primary text-sm px-5 py-2.5"
                    >
                      <HiOutlineRefresh className="w-4 h-4" />
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowError(false);
                      setProgress(0);
                      setCurrentStage(0);
                      onDismiss?.();
                    }}
                    className="btn-secondary text-sm px-5 py-2.5"
                  >
                    Go Back
                  </button>
                </div>
              </>
            ) : (
              /* ─── Processing State ─── */
              <>
                {/* Animated icon */}
                <motion.div
                  key={currentStage}
                  initial={{ scale: 0.5, opacity: 0, y: -10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="text-5xl mb-5"
                >
                  {STAGES[currentStage]?.icon}
                </motion.div>

                {/* Stage label */}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentStage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="text-base font-medium text-slate-200 mb-6"
                  >
                    {STAGES[currentStage]?.label}
                  </motion.p>
                </AnimatePresence>

                {/* Progress bar */}
                <div className="progress-track mb-4">
                  <motion.div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {/* Progress percentage */}
                <p className="text-xs text-slate-500 font-mono">
                  {Math.round(progress)}%
                </p>

                {/* Stage dots */}
                <div className="flex justify-center gap-2 mt-5">
                  {STAGES.map((stage, index) => (
                    <motion.div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index < currentStage
                          ? 'bg-emerald-500'
                          : index === currentStage
                          ? 'bg-indigo-400'
                          : 'bg-slate-700'
                      }`}
                      animate={
                        index === currentStage
                          ? { scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }
                          : {}
                      }
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
