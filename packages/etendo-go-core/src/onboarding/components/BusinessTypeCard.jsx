import React from 'react';

export function BusinessTypeCard({ icon: Icon, label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(18,18,23,0.05)] transition-colors ${
        selected ? 'border-[#121217]' : 'border-[#E8EAEF] hover:border-slate-300'
      }`}
    >
      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center">
        <span
          className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] bg-white shadow-[0_1px_2px_rgba(18,18,23,0.05)] ${
            selected ? 'border-[#121217]' : 'border-[#D1D4DB]'
          }`}>
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-[#121217]" />}
        </span>
      </span>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#D1D4DB] bg-white shadow-[0_1px_2px_rgba(18,18,23,0.05)]">
        {Icon && <Icon className="h-6 w-6 text-slate-400" data-testid="Icon__79cf84" />}
      </div>
      <p className="text-sm font-medium leading-5 text-slate-900">{label}</p>
    </button>
  );
}

export default BusinessTypeCard;
