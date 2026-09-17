# Projection methods

The Projection panel supports PCA and a three-dimensional t-SNE embedding. Both use centered numeric features, optionally standardized to unit sample variance.

## PCA objectives

Maximizing retained variance and minimizing squared reconstruction error yield the same rank-three orthogonal projection for the same preprocessed data. The objective selector changes the emphasized metric, not the point positions.

Relative squared reconstruction error is `sum((X - X_reconstructed)^2) / sum(X^2)` for centered, optionally standardized `X`. It equals one minus the sum of the retained explained-variance ratios. This is a dimensionless fraction, not an error in the original measurement units when standardization is enabled.

## t-SNE

The app implements exact t-SNE using symmetric Gaussian input affinities, a Student-t kernel with one degree of freedom, and KL-divergence minimization in three dimensions. It uses 500 optimization iterations, early exaggeration of 4 for 100 iterations, a learning rate of 100, momentum, adaptive gains, and fixed random seed 42. The implementation follows [van der Maaten and Hinton (2008)](https://www.jmlr.org/papers/v9/vandermaaten08a.html).

Runs execute in a module Web Worker. Selecting another method, dataset, or parameter terminates the previous computation. At most 500 rows are evenly sampled from the loaded data (which itself may already be sampled to 2,500 rows during CSV import). The panel reports the actual row count and perplexity. Perplexity is capped at 50 and must be below the number of embedded rows. The fixed seed makes repeated runs with identical inputs reproducible.

The score is KL divergence, not explained variance or reconstruction error. It is useful for comparing optimization runs with the same data and affinity settings; it is not directly comparable across perplexities or datasets. A fixed iteration budget does not guarantee convergence. Local neighborhoods are emphasized; global distances, cluster sizes, and axis directions should not be interpreted like PCA components.

Tests check affinity normalization, an analytical gradient against finite differences, reproducibility, finite coordinates, and PCA error against explicit reconstruction. All analysis runs locally and requires no API key.
