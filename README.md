# PCA Cloud ☁️

A browser-based PCA visualizer that turns rows of data into a softly illuminated, three-dimensional cloud in the sky. Built with vanilla JavaScript and Canvas 2D, without a build step.

## GitHub Pages

Site address after deployment: https://archipelagoing.github.io/PCACloud/

In [repository Settings → Pages](https://github.com/archipelagoing/PCACloud/settings/pages), select **GitHub Actions** as the build and deployment source. The included [deployment workflow](.github/workflows/pages.yml) tests and publishes the app on every push to `main`. You can also run it manually from the repository's **Actions** tab after enabling Pages.

Only the HTML, stylesheet, and browser JavaScript are published. All asset paths are relative so the app works under the `/PCACloud/` project path. Uploaded CSVs are processed on the visitor's device.

## Run

```sh
npm start
```

Open http://localhost:5173. Requires Python 3 to serve the static files. Any static web server works, too.

## Explore

- Start with the deterministic synthetic atmospheric dataset, or upload a CSV with headers and at least two numeric columns.
- Drag the sky to orbit, scroll or use the +/− buttons to zoom.
- Toggle standardization; inspect the explained variance of the first three principal components.
- Switch between shaded cloud particles and exact data points. Adjust particle size and opacity independently of the analysis.
- Save the current sky as a PNG.

## Kaggle datasets

Expand **Import from Kaggle**, paste a public dataset link (or `owner/dataset-name`), and choose **Find CSVs**. Select a file and click **Visualize dataset**. **Try Iris dataset** loads `uciml/iris/Iris.csv` in one click. Each import requests the current file from Kaggle; datasets are not periodically refreshed in the background.

Downloads go directly from Kaggle to the visitor's browser without API keys or a backend. CSV files are limited to 5 MB, and PCA runs locally. Availability depends on Kaggle's browser access, rate limits, and dataset permissions. Private datasets, competition authentication, and ZIP extraction are not supported; download and unzip those files yourself, then use the existing CSV upload. Errors leave the previous visualization intact. The source link credits the dataset on Kaggle.

All numeric columns are included, including numeric identifiers such as Iris's `Id` column. Remove unwanted identifier columns before uploading if you want them excluded from PCA.

CSV data is processed entirely in the browser. Text columns are excluded, incomplete rows are skipped, and datasets exceeding 2,500 valid rows are evenly sampled before analysis. Limits: 5 MB per file, 100 columns. Two-feature data is rendered in a plane. Constant data produces a validation message. PCA uses a symmetric covariance matrix and cyclic Jacobi eigendecomposition. Cloud appearance is artistic, not a physical weather simulation.

Google Fonts loads the fonts; system fonts work offline. Using the Kaggle importer also contacts Kaggle and its download host. The visualization does not upload data or require API keys.

## Verify

```sh
npm test
```

Uses Node's built-in test runner to check eigenvalues, orthogonal components, scale invariance, CSV parsing, and input validation.
--
For Tyler
--
