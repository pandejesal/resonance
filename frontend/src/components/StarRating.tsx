import React, { useState } from 'react';
import { cn } from '../lib/utils';

interface StarRatingProps {
  rating: number | null;
  onChange?: (rating: number | null) => void;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export default function StarRating({ rating, onChange, size = 'md' }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const handleClick = (star: number) => {
    if (!onChange) return;
    if (rating === star) {
      onChange(null);
    } else {
      onChange(star);
    }
  };

  const displayRating = hoverRating !== null ? hoverRating : rating;

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHoverRating(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={cn(
            'transition-all duration-100',
            sizeMap[size],
            onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 rounded'
          )}
          onClick={() => handleClick(star)}
          onMouseEnter={() => onChange && setHoverRating(star)}
          style={{ touchAction: 'manipulation' }}
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          aria-pressed={displayRating !== null && star <= displayRating}
        >
          <svg
            viewBox="0 0 24 24"
            fill={displayRating !== null && star <= displayRating ? 'rgb(var(--brand-500))' : 'none'}
            stroke={displayRating !== null && star <= displayRating ? 'rgb(var(--brand-500))' : 'currentColor'}
            strokeWidth={2}
            className={cn(
              'w-full h-full transition-colors',
              displayRating !== null && star <= displayRating
                ? 'text-brand-500'
                : 'text-white/20'
            )}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}
