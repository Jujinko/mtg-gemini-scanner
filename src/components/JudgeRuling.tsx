import React, { useState } from 'react';
import { JudgeResponse } from '../services/judge';
import JudgeFeedbackWidget from './JudgeFeedbackWidget';
import { ChevronDown, ChevronUp, AlertCircle, BookOpen } from 'lucide-react';

interface JudgeRulingProps {
  response: JudgeResponse;
  traceId: string;
}

export default function JudgeRuling({ response, traceId }: JudgeRulingProps) {
  const [showSteps, setShowSteps] = useState(false);

  if (response.insufficient) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-200 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">I'm sorry, I don't have enough confidence or context to give an accurate ruling here.</p>
        </div>
        <JudgeFeedbackWidget traceId={traceId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* TL;DR */}
      <div className="text-lg font-medium text-zinc-100 leading-snug">
        {response.tldr}
      </div>

      {/* Reasoning Steps */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 overflow-hidden">
        <button
          onClick={() => setShowSteps(!showSteps)}
          className="w-full flex items-center justify-between p-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50 transition-colors"
        >
          <span>Judge's Breakdown</span>
          {showSteps ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {showSteps && (
          <div className="p-4 border-t border-zinc-800 flex flex-col gap-3">
            {response.steps.map((step, idx) => (
              <div key={idx} className="flex gap-3 text-sm">
                <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center flex-shrink-0 text-xs">
                  {step.ordinal}
                </span>
                <div>
                  <p className="text-zinc-300">{step.description}</p>
                  {step.explanation && (
                    <p className="text-zinc-500 text-xs mt-1.5 italic">{step.explanation}</p>
                  )}
                  {step.rule_ref && (
                    <p className="text-emerald-400/70 text-xs mt-1 font-mono">Rule {step.rule_ref}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Citations */}
      {response.citations && response.citations.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Citations
          </h4>
          <div className="flex flex-col gap-2">
            {response.citations.map((cite, idx) => (
              <div key={idx} className="bg-zinc-900 border border-zinc-800/50 p-2.5 rounded text-xs text-zinc-400">
                <span className="font-semibold text-zinc-300 mb-1 block">
                  {cite.card} <span className="text-zinc-500 font-normal">({cite.type})</span>
                </span>
                <span className="block border-l-2 border-zinc-700 pl-2 ml-0.5">"{cite.text}"</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-[10px] text-zinc-500 border-t border-zinc-800 pt-3">
        {response.disclaimer}
      </div>

      <JudgeFeedbackWidget traceId={traceId} />
    </div>
  );
}
