'use client';

import React, { useState } from 'react';
import { Sparkles, MessageSquare, Loader2, ArrowRight } from 'lucide-react';

interface ExtractionInputProps {
  onExtract: (message: string) => Promise<void>;
  isLoading: boolean;
  initialMessage?: string;
}

const SAMPLE_1 = "Rahul needs 2 Nike shoes at 2499 each and 3 Adidas shirts at 1299 each. GST 18%.";
const SAMPLE_2 = "bhai Rahul ko 3 shoes 2499 wale aur 2 cap 599 wali dena gst 18 mobile 9876543210";

export const ExtractionInput: React.FC<ExtractionInputProps> = ({
  onExtract,
  isLoading,
  initialMessage = '',
}) => {
  const [message, setMessage] = useState(initialMessage);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;
    await onExtract(message);
  };

  const handleSample = async (sampleText: string) => {
    setMessage(sampleText);
    await onExtract(sampleText);
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Raw Customer Message
          </h2>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          WhatsApp / Text / Transcript
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Paste raw customer message here...\ne.g. "Rahul needs 2 Nike shoes at 2499 each and 3 Adidas shirts at 1299 each. GST 18%."`}
          rows={6}
          className="w-full rounded-md border border-slate-300 bg-slate-50/50 p-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none font-sans"
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">Presets:</span>
            <button
              type="button"
              onClick={() => handleSample(SAMPLE_1)}
              disabled={isLoading}
              className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition-colors disabled:opacity-50"
            >
              Sample Order 1
            </button>
            <button
              type="button"
              onClick={() => handleSample(SAMPLE_2)}
              disabled={isLoading}
              className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition-colors disabled:opacity-50"
            >
              Sample Order 2 (Messy)
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading || !message.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extracting Invoice Data...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Extract Invoice</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
