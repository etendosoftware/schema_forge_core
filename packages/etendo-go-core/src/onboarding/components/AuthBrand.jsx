import React from 'react';

// `href` makes the logo and the name a link back to the public website. Without it the brand
// is plain, so a build that configures no website renders exactly as before.
export function AuthBrand({ label, href }) {
  const brand = (
    <>
      <img
        src="/favicon.png"
        alt={label}
        className="h-14 w-14 rounded-2xl border border-white/80 bg-white object-contain p-1 shadow-[0_12px_30px_rgba(250,204,21,0.45)]"
      />
      <span className="text-xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-2xl">
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} data-testid="auth-brand-link" className="flex items-center gap-3">
        {brand}
      </a>
    );
  }
  return <div className="flex items-center gap-3">{brand}</div>;
}

export default AuthBrand;
