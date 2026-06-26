import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { selectNextSurvey, SURVEY_TRIGGER_EVENT } from '../lib/surveys/survey-engine.js';
import {
  markFirstLogin,
  markSurveyShown,
  markSurveyResponded,
  markSurveyDismissed,
} from '../lib/surveys/survey-state.js';
import { track } from '../lib/observability.js';
import { OBSERVABILITY_EVENTS, buildObservabilityEvent } from '../lib/observability/events.js';

function isAdminRole(selectedRole) {
  return selectedRole?.name?.toLowerCase().includes('admin') ?? false;
}

function trackSurveyEvent(eventDef, properties) {
  const { name, properties: safeProps } = buildObservabilityEvent(eventDef, properties);
  if (name) void track(name, safeProps);
}

export function useSurveyEngine() {
  const { isAuthenticated, selectedRole } = useAuth();
  const [activeSurvey, setActiveSurvey] = useState(null);

  const checkAndShowSurvey = useCallback(() => {
    if (!isAuthenticated) return;
    const isAdmin = isAdminRole(selectedRole);
    const survey = selectNextSurvey({ isAdmin });
    if (!survey) return;
    markSurveyShown(survey.id);
    trackSurveyEvent(OBSERVABILITY_EVENTS.SURVEY_SHOWN, {
      type: survey.type,
      source: survey.id,
    });
    setActiveSurvey(survey);
  }, [isAuthenticated, selectedRole]);

  useEffect(() => {
    if (!isAuthenticated) return;
    markFirstLogin();
    checkAndShowSurvey();
  }, [isAuthenticated, checkAndShowSurvey]);

  useEffect(() => {
    const handler = () => checkAndShowSurvey();
    window.addEventListener(SURVEY_TRIGGER_EVENT, handler);
    return () => window.removeEventListener(SURVEY_TRIGGER_EVENT, handler);
  }, [checkAndShowSurvey]);

  const handleRespond = useCallback((score) => {
    if (!activeSurvey) return;
    markSurveyResponded(activeSurvey.id);
    trackSurveyEvent(OBSERVABILITY_EVENTS.SURVEY_RESPONDED, {
      type: activeSurvey.type,
      source: activeSurvey.id,
      score,
    });
  }, [activeSurvey]);

  const handleClose = useCallback(() => {
    setActiveSurvey(null);
  }, []);

  const handleDismiss = useCallback(() => {
    if (!activeSurvey) return;
    markSurveyDismissed(activeSurvey.id);
    trackSurveyEvent(OBSERVABILITY_EVENTS.SURVEY_DISMISSED, {
      type: activeSurvey.type,
      source: activeSurvey.id,
    });
    setActiveSurvey(null);
  }, [activeSurvey]);

  return { activeSurvey, handleRespond, handleClose, handleDismiss };
}
