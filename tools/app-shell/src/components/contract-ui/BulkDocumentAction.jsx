import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select.jsx';
import { Label } from '@/components/ui/label.jsx';
import { ListChecks } from 'lucide-react';
import { useUI } from '@schema-forge/app-shell-core';
import { useDocumentAction } from '@/hooks/useDocumentAction';

const STORAGE_KEY = 'bulkActionResult';

export const buildInOutActions = (rows) => {
  const hasDraft = rows.some((r) => (r.documentStatus || r.docStatus) === 'DR');
  return hasDraft ? [{ value: 'CO', labelKey: 'book' }] : [];
};

export default function BulkDocumentAction({
  selectedRows, clearSelection, token, apiBaseUrl,
  entity = 'header',
  buildActions,
  rowFilter,
  labelKey = 'bulkCompletion',
}) {
  const ui = useUI();
  const { execute } = useDocumentAction({ apiBaseUrl, entity, token });
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);

  const actions = useMemo(() => {
    if (buildActions) return buildActions(selectedRows);
    const statusOf = (r) => r.documentStatus || r.docStatus;
    const hasDraft = selectedRows.some((r) => statusOf(r) === 'DR');
    const hasCompleted = selectedRows.some((r) => statusOf(r) === 'CO');
    const out = [];
    if (hasDraft) out.push({ value: 'CO', labelKey: 'book' });
    if (hasCompleted) out.push({ value: 'RE', labelKey: 'reactivate' });
    return out;
  }, [selectedRows, buildActions]);

  if (selectedRows.length === 0 || actions.length === 0) return null;

  const handleOpen = () => {
    setSelectedAction(actions[0].value);
    setOpen(true);
  };

  const handleDone = async () => {
    if (running || !selectedAction) return;
    setRunning(true);

    let rowsToProcess = selectedRows;
    let preBlocked = [];
    if (rowFilter) {
      rowsToProcess = [];
      for (const row of selectedRows) {
        const result = rowFilter(row, selectedAction);
        if (result === true || result == null) {
          rowsToProcess.push(row);
        } else {
          preBlocked.push({ documentNo: row.documentNo || row.id, message: result });
        }
      }
    }

    const outcomes = await Promise.allSettled(
      rowsToProcess.map((row) => execute(row.id, selectedAction).then(() => row)),
    );
    const apiFailed = outcomes
      .map((o, i) => ({ o, row: rowsToProcess[i] }))
      .filter(({ o }) => o.status === 'rejected')
      .map(({ o, row }) => ({
        documentNo: row.documentNo || row.id,
        message: o.reason?.message || 'Unknown error',
      }));
    const failed = [...preBlocked, ...apiFailed];
    const ok = rowsToProcess.length - apiFailed.length;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ok, failed }));
    setRunning(false);
    setOpen(false);
    const delay = failed.length === 0 ? 600 : 1500;
    setTimeout(() => {
      clearSelection();
      window.location.reload();
    }, delay);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleOpen} disabled={running}>
        <ListChecks className="h-3.5 w-3.5" />
        {ui(labelKey)} ({selectedRows.length})
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ui(labelKey)}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>{ui('documentAction')}</Label>
            <Select value={selectedAction ?? ''} onValueChange={setSelectedAction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {actions.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {ui(a.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
              {ui('cancel')}
            </Button>
            <Button onClick={handleDone} disabled={running || !selectedAction}>
              {ui('done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
