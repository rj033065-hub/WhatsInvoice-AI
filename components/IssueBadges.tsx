'use client';

import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface IssueBadgesProps {
  issues: string[];
  onDismiss?: (index: number) => void;
}

export const IssueBadges: React.FC<IssueBadgesProps> = ({ issues, onDismiss }) => {
  if (!issues || issues.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>No missing customer or price details flagged.</span>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-2 text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-amber-900">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>Ambiguities Flagged — Please Confirm Details ({issues.length})</span>
      </div>
      <ul className="list-disc list-inside space-y-1 text-amber-800 font-sans">
        {issues.map((issue, idx) => (
          <li key={idx} className="flex items-center justify-between">
            <span>{issue}</span>
            {onDismiss && (
              <button
                onClick={() => onDismiss(idx)}
                className="ml-2 text-amber-600 hover:text-amber-900 font-bold"
              >
                &times;
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
