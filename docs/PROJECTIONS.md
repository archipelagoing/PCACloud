# Projection methods

The Projection panel supports PCA and a three-dimensional t-SNE embedding. Both use centered numeric features, optionally standardized to unit sample variance.

## PCA objectives

Maximizing retained variance and minimizing squared reconstruction error yield the same rank-three orthogonal projection for the same preprocessed data. The objective selector changes the emphasized metric, not the point positions.

Relative squared reconstruction error is `sum((X - X_reconstructed)^2) / sum(X^2)` for centered, optionally standardized `X`. It equals one minus the sum of the retained explained-variance ratios. This is a dimensionless fraction, not an error in the original measurement units when standardization is enabled.

## Learning panel

**Understand this cloud** is available in PCA mode. It shows all component variance ratios, the cumulative spectrum, and the minimum component counts reaching 90% and 95%. The first three bars correspond to the cloud. These metrics describe the analyzed rows, including any sampling, rather than guaranteeing variance retention for the entire source file.

The feature-weight table displays the entries of each retained unit eigenvector, highlighting the three largest absolute weights. A component score is `z_ij = sum_l(X_il * V_lj)` in the preprocessed space. Positive and negative weights describe opposite directions; the overall sign is arbitrary. Loadings describe the projection and do not establish causal importance or guarantee class separation. A zero-variance component may have an arbitrary direction and should not be interpreted as a meaningful pattern.

The four-point lesson uses `(1,3), (3,1), (5,3), (7,5)` from Assignment 2, Part 1.1. It uses population covariance and population standard deviations, dividing by `n`, so the unstandardized covariance is `[[5,2],[2,2]]`, the eigenvalues are 6 and 1, and D's PC1 score is `8 / sqrt(5)`. Changing the units of feature two changes unstandardized PCA; standardization removes that dependence. Lines to PC1 reconstructions show the discarded perpendicular distances.

The main implementation uses sample covariance and sample standard deviations, dividing by `n - 1`. Consistent population versus sample preprocessing gives the same component directions and explained-variance ratios, but different covariance eigenvalues and standardized scores. Unstandardized inputs in the main implementation are divided by one common magnitude to avoid overflow. Returned eigenvalues refer to that numerically scaled space, not original measurement units. The scene also uniformly scales projected coordinates to fit the viewport, preserving relative geometry before the camera's perspective rendering.

## t-SNE

The app implements exact t-SNE using symmetric Gaussian input affinities, a Student-t kernel with one degree of freedom, and KL-divergence minimization in three dimensions. It uses 500 optimization iterations, early exaggeration of 4 for 100 iterations, a learning rate of 100, momentum, adaptive gains, and fixed random seed 42. The implementation follows [van der Maaten and Hinton (2008)](https://www.jmlr.org/papers/v9/vandermaaten08a.html).

Runs execute in a module Web Worker. Selecting another method, dataset, or parameter terminates the previous computation. At most 500 rows are evenly sampled from the loaded data (which itself may already be sampled to 2,500 rows during CSV import). The panel reports the actual row count and perplexity. Perplexity is capped at 50 and must be below the number of embedded rows. The fixed seed makes repeated runs with identical inputs reproducible.

The score is KL divergence, not explained variance or reconstruction error. It is useful for comparing optimization runs with the same data and affinity settings; it is not directly comparable across perplexities or datasets. A fixed iteration budget does not guarantee convergence. Local neighborhoods are emphasized; global distances, cluster sizes, and axis directions should not be interpreted like PCA components.

Tests check affinity normalization, an analytical gradient against finite differences, reproducibility, finite coordinates, and PCA error against explicit reconstruction. All analysis runs locally and requires no API key.
