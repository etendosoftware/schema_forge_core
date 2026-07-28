function serializeDraft(draft) {
  return JSON.stringify(draft);
}

function findPersistableStep(steps, stepId) {
  return steps.find((step) => step.id === stepId && step.persistable);
}

function buildDraft({ steps, stepId, form }) {
  const step = findPersistableStep(steps, stepId);
  if (!step) return null;

  return {
    step: step.draftStep ?? step.id,
    form,
  };
}

function hasMeaningfulFormChange(form, defaultForm) {
  return JSON.stringify(form) !== JSON.stringify(defaultForm || {});
}

/**
 * Owns the debounce and final-flush policy for onboarding drafts. Keeping it
 * outside React makes the persistence rules reusable and testable without a
 * browser renderer.
 */
export function createOnboardingDraftPersistence({ defaultForm = {}, saveDraft, onSaveFailure = () => {} }) {
  let lastSavedSerialized = null;
  let pendingDraft = null;
  let timer = null;
  let saveInFlight = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const shouldSave = (draft) => {
    if (!draft) return false;
    const serialized = serializeDraft(draft);
    if (serialized === lastSavedSerialized) return false;

    // An untouched form must never create a draft. Once a draft exists, a
    // deliberate revert to defaults still needs saving so resume is accurate.
    return hasMeaningfulFormChange(draft.form, defaultForm) || lastSavedSerialized !== null;
  };

  const flush = async (context) => {
    clearTimer();
    const draft = context ? buildDraft(context) : pendingDraft;
    pendingDraft = null;

    // A navigation or logout can request a newer snapshot while the debounce
    // save is still running. Finish that write first, then compare and persist
    // the newest snapshot rather than racing two independent requests.
    if (saveInFlight) {
      await saveInFlight;
    }

    if (!shouldSave(draft)) return false;

    const save = (async () => {
      try {
        await saveDraft(draft);
        lastSavedSerialized = serializeDraft(draft);
        return true;
      } catch (error) {
        onSaveFailure(error);
        return false;
      }
    })();
    saveInFlight = save;

    try {
      return await save;
    } finally {
      if (saveInFlight === save) {
        saveInFlight = null;
      }
    }
  };

  return {
    schedule(context, delay = 1500) {
      const draft = buildDraft(context);
      clearTimer();
      pendingDraft = draft;
      if (!shouldSave(draft)) return;
      timer = setTimeout(() => {
        void flush();
      }, delay);
    },
    flush,
    cancel() {
      clearTimer();
      pendingDraft = null;
    },
    restoreLastSaved(draft) {
      lastSavedSerialized = draft ? serializeDraft(draft) : null;
    },
  };
}

export function restoreOnboardingDraft({ draft, defaultForm = {}, steps }) {
  if (!draft?.form || typeof draft.form !== 'object') return null;

  const step = steps.find((candidate) => candidate.persistable && (
    candidate.draftStep === draft.step || candidate.id === draft.step
  ));
  if (!step) return null;

  return {
    stepId: step.id,
    form: { ...defaultForm, ...draft.form },
  };
}
