# PCA Cloud TODO

Based on the current working tree. Unchecked verification items mean “confirm this,” not that the feature is broken. Optional additions are ideas, not release requirements.

## Release checks

- [ ] Confirm GitHub Pages uses **GitHub Actions** as its deployment source, following [README.md](README.md#github-pages). Repository settings and deployment status have not been verified here.
- [ ] Run `npm test` before publishing the current changes and confirm the Pages workflow succeeds.
- [ ] Smoke-test the deployed `/PCACloud/` site: sample data, CSV upload, PCA/t-SNE switching, worker loading, controls, and PNG export. Confirm the favicon and other assets load.
- [ ] Test the live Kaggle importer from the deployed site, including **Try Iris dataset**. Existing tests mock network responses; they do not verify Kaggle's browser access or redirects.
- [ ] Check desktop and mobile layouts, touch orbiting, page scrolling, and access to all controls with the Kaggle and t-SNE panels expanded.

## Fixes and polish

- [ ] Update the README's feature list and verification section for t-SNE and reconstruction error; link [PROJECTIONS.md](PROJECTIONS.md).
- [ ] Update **How it works**, the canvas accessible label, and Kaggle success text to explain the selected projection. These currently describe PCA even when t-SNE is selected.
- [ ] Guard local CSV reads against stale results. `importFile()` awaits `file.text()` without a selection token, so an older upload can finish after a newer upload, sample selection, or Kaggle import and replace it.
- [ ] Keep Kaggle attribution attached to the displayed dataset until a replacement loads successfully. Starting an invalid local upload currently hides the source link even though the old visualization remains.
- [ ] Add keyboard orbit controls and a visible focus indicator for the canvas; verify focus visibility on the upload control, selects, and expandable Kaggle section.
- [ ] Review small text and contrast, browser zoom, screen-reader announcements, and reduced-motion behavior. Provide a useful text summary of the active projection.
- [ ] Avoid continuously redrawing an unchanged scene when rotation is off, and pause rendering while the page is hidden. The render loop currently requests another frame unconditionally.

## Verification to add

- [ ] Add browser coverage for upload errors preserving the previous visualization, competing dataset loads, and attribution updates.
- [ ] Test t-SNE cancellation when changing methods, datasets, or parameters, plus worker failure falling back to PCA without stale results appearing.
- [ ] Extend CSV tests for BOMs, escaped quotes, embedded newlines, malformed row lengths, mixed text/numeric columns, and the 100-column limit.
- [ ] Add Kaggle tests for streamed downloads exceeding 5 MB without a content-length header, timeouts, empty listings, API error messages, and the pagination limit.
- [ ] Run tests on pull requests as well as pushes to `main`; the current workflow only runs on main pushes and manual dispatch.
- [ ] Measure responsiveness near the supported limits (5 MB, 2,500 analyzed rows, 100 columns, and 500 t-SNE rows). Use the results to decide whether CSV parsing and PCA should also move into a worker.

## Optional additions

- [ ] **Feature selection:** let users exclude numeric IDs and choose measurement columns without editing the CSV first.
- [ ] **Import preview:** show included/excluded columns, missing values, constant columns, and sampling decisions before analysis.
- [ ] **Point details and colors:** preserve row identifiers and text labels, add hover/click inspection, and color by a chosen category or measurement with a legend.
- [ ] **PCA interpretation:** show feature loadings and a scree plot so users can understand which variables drive each component.
- [ ] **2D view:** offer a flat projection alongside the current 3D view.
- [ ] **Analysis exports:** download projected coordinates, PCA loadings, metrics, and run settings; retain source-row mapping through both sampling stages.
- [ ] **Image export options:** include the dataset name, projection method, legend, and metrics, with a configurable image resolution.
- [ ] **t-SNE controls:** expose seed and iteration count, add explicit cancellation, and optionally plot optimization progress. Explain that the current fixed-seed **Run again** repeats the same result for identical inputs.
- [ ] **Sampling options:** offer reproducible random sampling as an alternative to evenly spaced rows, which can interact with ordered or periodic datasets.
- [ ] **Remember preferences:** save appearance and projection settings locally, with a reset option and without persisting uploaded data by default.
- [ ] **More examples:** bundle small, documented CSVs demonstrating clusters, outliers, scale differences, and two-feature data so examples work without Kaggle.
- [ ] **Offline use:** consider self-hosted fonts and a service worker for the app shell, with a clear cache-update strategy.

Suggested order: finish release checks and correctness fixes, add browser regression coverage, then prioritize feature selection and point inspection.
