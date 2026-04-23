# Document

This guide complements `app-shell-functional-flows.md` and covers the generated Document window.

- **Purpose and surface:** Maintain uploaded document metadata, including category, project linkage, uploader, status, tags, and read-only audit fields.
- **Route:** `/document` and `/document/:recordId`
- **Visibility:** Hidden route-only window because the Projects menu group is hidden in the app shell.
- **Implementation:** Generated window.
- **Key functional cues:**
  - The window is a single-entity surface with primary entity `document` and no child entities.
  - Required editable fields are `Name`, `Category`, and `Status`.
  - Optional editable fields are `Project` and `Tags`.
  - `Uploaded By`, `Upload Date`, `File Size`, and `Version` are read-only review fields in the current contract.
  - Searchable list fields are `name`, `category`, and `status`.
  - No related-documents panel, window-specific menu actions, or custom components are declared in the current contract.
- **Manual verification:**
  1. Open `/document` directly and confirm the list loads without any visible Projects menu entry.
  2. Create or edit a document and confirm the form requires name, category, and status.
  3. Confirm project linkage and tags are optional.
  4. Verify uploader, upload date, file size, and version render as read-only metadata rather than editable inputs.
  5. Reopen `/document/:recordId` directly and confirm the same metadata is preserved.
- **Automated evidence:** No document-specific frontend test was found. Use the shared app-shell guide for generic route/loading and CRUD behavior.
