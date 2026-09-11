import * as React from "react"

import { cn } from "../../lib/utils.js"

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom", className)}
      {...props} />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  // WARN(a11y): border-border-subtle, not border-border-structural — see TableRow below.
  (<thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border-subtle", className)} {...props} />)
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props} />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  // WARN(a11y): border-border-subtle, not border-border-structural — see TableRow below.
  (<tfoot
    ref={ref}
    className={cn("border-t border-border-subtle font-medium [&>tr]:last:border-b-0", className)}
    {...props} />)
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    // WARN(a11y): intentionally border-border-subtle, NOT border-border-structural,
    // for the whole Table (header, body rows, footer). A table hairline isn't a UI
    // component boundary under WCAG 1.4.11 (cell content + hover/selected bg already
    // convey the boundary), so it doesn't need the enforced 3:1 contrast — confirmed
    // against staging (go.staging.etendo.cloud), which never had this distinction.
    // border-border-structural stays reserved for genuinely structural separators
    // elsewhere (e.g. BalanceFooterPanel, DocumentTotalsPanel).
    className={cn(
      "border-b border-border-subtle transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props} />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      // ETP-5281 — symmetric with TableCell below: without this, a header
      // label had no clipping boundary at the <th> level either, so if the
      // label's OWN markup didn't truncate itself (many hand-built tables just
      // render plain text/children with no truncate class of their own), long
      // header text visually overflowed into the neighboring header cell —
      // confirmed on Contacts at 390px width (a 28px-wide header cell showing a
      // 65px-wide label). `cn()` still lets a caller's own `className` win per
      // conflict group, same override path `whitespace-normal` etc. has on
      // TableCell. This alone does not make text SHOW an ellipsis unless the
      // element holding the actual text also constrains its own width — see
      // DataTable.jsx's `renderColumnHeaderCell` for that half of the fix.
      "h-11 px-3 text-left align-middle text-sm font-medium text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap min-w-0 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props} />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      // ETP-5281 — overflow-safe by default: without this, a long cell value had
      // no clipping behavior at all and could overlap the next column (affects
      // every list window that doesn't already override it). `cn()` is
      // tailwind-merge, so a caller's own `className` still wins per conflict
      // group — e.g. `whitespace-normal` overrides `whitespace-nowrap` here for
      // a table that genuinely needs multi-line wrapping. `min-w-0` keeps this
      // safe inside a flex/grid ancestor (without it, a flex/grid item's default
      // `min-width: auto` can block the cell from ever shrinking enough to clip).
      "px-3 py-2.5 align-middle overflow-hidden text-ellipsis whitespace-nowrap min-w-0 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props} />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props} />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
