export default function SectionSaveButton({ error, hideSave, save, saving, ui }) {
  return (
    <>
      {error && <p className="text-sm text-destructive mt-4">{error}</p>}
      {!hideSave && (
        <div className="pt-4">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#121217] text-white text-sm font-medium hover:bg-[#121217]/90 disabled:opacity-50 transition-colors"
          >
            {saving ? ui('fiscal.saving') : ui('fiscal.save')}
          </button>
        </div>
      )}
    </>
  );
}
