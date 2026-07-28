import React from 'react';
import { ChevronDown, PanelLeftClose, Search, Calendar, SlidersHorizontal } from 'lucide-react';
import {
  SKELETON_BG,
  ICON_COLOR,
  MENU_GROUPS,
  TABLE_ROW_1,
  TABLE_ROW_2,
  EMPTY_ROW_COUNT,
  Bar,
  RailMenuItem,
  TableRow,
} from './dashboardSkeletonParts.jsx';

/**
 * Static dashboard skeleton shown in the Auth (login/register) right panel,
 * below the marketing copy. Unlike SetupPreviewMockup (which is anchored
 * full-screen and animates between profile/company variants), this is a
 * single fixed view sized to fill the remaining space under the marketing
 * text — no h-screen, no absolute anchoring, no transition state.
 */
export function AuthPreviewMockup(props) {
  return (
    <div className="relative mt-6 flex-1" data-testid="AuthPreviewMockup__79cf84" {...props}>
      <div className="absolute inset-0 -right-12 -bottom-12 flex overflow-hidden rounded-tl-[20px] border-l border-t border-[#E4E7EC] bg-[#F5F7F9] shadow-[-8px_-8px_20px_-4px_rgba(18,18,23,0.12),-3px_-3px_8px_-2px_rgba(18,18,23,0.08)] xl:-right-14">
        {/* Navigation Rail */}
        <aside className="flex w-[240px] flex-none flex-col bg-[#F6F7F9]">
          <div className="flex h-[63px] flex-none items-center gap-1.5 px-2">
            <div className="mx-2 flex h-full flex-1 items-center justify-between border-b border-[#E8EAEF] pl-1">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <img src="/favicon.png" alt="" className="h-6 w-6 flex-none rounded-md object-contain" />
                <span className={`inline-block h-2.5 w-[90px] rounded-full ${SKELETON_BG}`} />
              </div>
              <span className={ICON_COLOR}>
                <ChevronDown className="h-5 w-5" strokeWidth={1.7} />
              </span>
            </div>
            <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-md ${ICON_COLOR}`}>
              <PanelLeftClose className="h-5 w-5" strokeWidth={1.7} />
            </span>
          </div>

          <nav className="flex flex-1 flex-col gap-3 overflow-hidden py-2 pl-2">
            {MENU_GROUPS.map((group, gi) => (
              <div key={gi} className="flex flex-col gap-1">
                <div className="flex h-8 items-center px-4">
                  <Bar width={group.headingWidth} />
                </div>
                {group.items.map(([Icon, width, hasChevron], ii) => (
                  <RailMenuItem key={ii} icon={Icon} width={width} hasChevron={hasChevron} />
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[62px] flex-none items-center gap-3.5 px-2">
            <div className="flex flex-col gap-1.5">
              <span className={`inline-block h-3.5 w-20 rounded-full ${SKELETON_BG}`} />
              <span className={`inline-block h-2.5 w-12 rounded-full ${SKELETON_BG}`} />
            </div>
            <div className="flex h-10 w-full max-w-[392px] items-center gap-2 rounded-full bg-white px-3">
              <span className={`flex-none ${ICON_COLOR}`}>
                <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
              <span className={`inline-block h-3 w-44 rounded-full ${SKELETON_BG}`} />
            </div>
          </div>
          <div className="flex-1 overflow-hidden pb-2 pr-2">
            <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white">
              <div className="flex flex-none items-center gap-2 px-2 pb-2 pt-4">
                <div className="flex h-10 flex-none items-center gap-1.5 rounded-lg border border-[#D1D4DB] bg-white px-3 shadow-[0px_1px_2px_rgba(18,18,23,0.05)]">
                  <Bar width={122} />
                  <ChevronDown className={`h-[18px] w-[18px] ${ICON_COLOR}`} strokeWidth={1.7} />
                </div>
                <div className={`flex h-10 flex-none items-center gap-1.5 rounded-lg border border-[#D1D4DB] bg-white px-3 shadow-[0px_1px_2px_rgba(18,18,23,0.05)] ${ICON_COLOR}`}>
                  <Calendar className="h-5 w-5" strokeWidth={1.7} />
                  <Bar width={122} />
                  <ChevronDown className="h-[18px] w-[18px]" strokeWidth={1.7} />
                </div>
                <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-[#D1D4DB] bg-white shadow-[0px_1px_2px_rgba(18,18,23,0.05)] ${ICON_COLOR}`}>
                  <SlidersHorizontal className="h-5 w-5" strokeWidth={1.7} />
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <TableRow widths={TABLE_ROW_1} tall={false} checked={false} />
                <TableRow widths={TABLE_ROW_2} tall checked />
                {Array.from({ length: EMPTY_ROW_COUNT }).map((_, i) => (
                  <div key={i} className="flex h-[52px] items-center border-b border-[#E8EAEF]">
                    <div className="flex w-8 flex-none justify-center pl-2">
                      <span className="inline-block h-4 w-4 rounded border-[1.5px] border-[#D1D4DB] bg-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthPreviewMockup;
