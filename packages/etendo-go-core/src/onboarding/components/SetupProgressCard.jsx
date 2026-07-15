import React from 'react';

const RING_RADIUS = 36;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function SetupProgressCard({ progress, title, description, leading, statusLabel, success = false }) {
  const ringColor = success ? '#54b56a' : '#171923';
  const trackColor = success ? '#d9f2df' : '#e6eaf2';
  const barColor = success ? '#54b56a' : '#171923';
  const dashOffset = RING_CIRCUMFERENCE * (1 - Math.min(Math.max(progress, 0), 100) / 100);

  return (
    <div className="mx-auto w-full max-w-[980px] rounded-[1.75rem] border border-slate-200 bg-white px-8 py-10 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:px-12 sm:py-14">
      <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          {/* Static track ring */}
          <svg className="absolute inset-0 h-20 w-20 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r={RING_RADIUS} fill="none" stroke={trackColor} strokeWidth="8" />
          </svg>
          {/* Progress arc: reflects the real % AND spins continuously so the loader
              always shows motion (never a frozen image). Spin stops on success. */}
          <svg
            className={`absolute inset-0 h-20 w-20 ${success ? '-rotate-90' : 'animate-spin motion-reduce:animate-none'}`}
            style={{ animationDuration: '1.4s' }}
            viewBox="0 0 80 80"
            aria-hidden="true"
          >
            <circle
              cx="40"
              cy="40"
              r={RING_RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.4s ease' }}
            />
          </svg>
          <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl">
            {leading}
          </div>
        </div>

        <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-[2.2rem]">
          {title}
        </h2>
        <p className="mt-2 text-base text-slate-700 sm:text-lg">{description}</p>
      </div>

      <div className="mx-auto max-w-[460px]">
        <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
          <span>{statusLabel}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full" style={{ backgroundColor: trackColor }}>
          <div
            className="h-full rounded-full transition-all duration-300 motion-reduce:transition-none"
            style={{ width: `${progress}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
    </div>
  );
}

export default SetupProgressCard;
