import { forwardRef } from 'react';
import InvoiceLinesTable from '../shared/InvoiceLinesTable.jsx';

// forwardRef so DetailView can imperatively clear the selection / flush
// pending edits via inlineLinesRef. Mirrors the generated LinesTable pattern:
// when linesLayout='inlineEditable' and not in add-row mode, hand off to
// InlineLinesPanel for hover actions, inline edit, and clearSelection.
const InvoiceLineTableCustom = forwardRef(function InvoiceLineTableCustom(props, ref) {
  return <InvoiceLinesTable ref={ref} productRequired taxRequired {...props} />;
});

export default InvoiceLineTableCustom;
