import { useInspector } from './InspectorProvider.jsx';

/**
 * Wrapper that highlights a field when the inspector is in edit mode.
 * Clicking a highlighted field selects it in the inspector panel.
 *
 * Must be rendered inside an InspectorProvider (which lives in AppLayout).
 */
export function FieldHighlight({ entityName, fieldName, children }) {
  const inspector = useInspector();

  if (!inspector?.editMode) {
    return children;
  }

  const isSelected = inspector.selectedField === fieldName && inspector.selectedEntity === entityName;

  return (
    <div
      className={`relative cursor-pointer rounded transition-all ${
        isSelected
          ? 'ring-2 ring-primary ring-offset-1'
          : 'hover:ring-2 hover:ring-primary/40 hover:ring-offset-1'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        inspector.selectField(entityName, fieldName);
      }}
    >
      {children}
    </div>
  );
}
