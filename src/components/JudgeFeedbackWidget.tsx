import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send } from 'lucide-react';
import { logFeedback } from '../services/judgeFeedback';

interface JudgeFeedbackWidgetProps {
  traceId: string;
}

export default function JudgeFeedbackWidget({ traceId }: JudgeFeedbackWidgetProps) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleRate = async (newRating: 'up' | 'down') => {
    if (submitting) return;
    setRating(newRating);
    if (newRating === 'down') {
      setShowComment(true);
    } else {
      setSubmitting(true);
      await logFeedback(traceId, newRating, null);
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  const handleSubmitComment = async () => {
    if (submitting) return;
    setSubmitting(true);
    await logFeedback(traceId, rating, comment);
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center py-4 text-emerald-400 text-sm font-medium">
        Thank you for your feedback!
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-zinc-400">Did this ruling answer your question?</span>
        <div className="flex gap-2">
          <button
            onClick={() => handleRate('up')}
            disabled={submitting}
            className={`p-2 rounded hover:bg-zinc-800 transition-colors ${rating === 'up' ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-500'}`}
          >
            <ThumbsUp className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleRate('down')}
            disabled={submitting}
            className={`p-2 rounded hover:bg-zinc-800 transition-colors ${rating === 'down' ? 'text-rose-400 bg-rose-400/10' : 'text-zinc-500'}`}
          >
            <ThumbsDown className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showComment && !submitted && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What went wrong?"
            className="flex-1 bg-zinc-800 border-none rounded px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-rose-400/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitComment();
            }}
          />
          <button
            onClick={handleSubmitComment}
            disabled={submitting || !comment.trim()}
            className="px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
