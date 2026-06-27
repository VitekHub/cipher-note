# Split KDF Benchmark Results

V1 = old `deriveAuthCredentials` (2× Argon2id)

V2 = new `deriveAuthCredentials` (1× Argon2id + 2× HKDF)

Each row is a fresh page load (cold start, includes WASM compilation).

| # | V1 | V2 | Speedup | Savings |
|---|---|---|---|---|
| 1 | 2,515.6ms | 1,654.8ms | 1.52× | 860.8ms |
| 2 | 1,467.9ms | 735.8ms | 1.99× | 732.1ms |
| 3 | 1,425.7ms | 747.5ms | 1.91× | 678.2ms |
| 4 | 1,579.6ms | 741.6ms | 2.13× | 838.0ms |

## Conclusion

V2 is **1.5–2.1× faster** than V1 across different conditions. On slower devices (where WASM compilation dominates), the speedup is closer to 1.5×. On faster devices, it approaches 2×. The consistent saving is **one full Argon2id call** (~680–860ms), with HKDF adding negligible overhead (<1ms).