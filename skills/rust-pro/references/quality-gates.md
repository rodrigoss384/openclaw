# Rust quality gates

## Minimum deterministic gates

Use repository commands when defined. Otherwise, for the selected Cargo workspace/package, the expected command shapes are:

```bash
cargo fmt --all -- --check
cargo check --workspace --all-targets --all-features
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-targets --all-features
```

Do not paste these blindly when the project intentionally uses a narrower feature matrix, target set or wrapper task. Record the exact real commands, cwd, pinned toolchain, exit code and output evidence.

Production lint policy should deny `unsafe_code` by default and make panic-prone shortcuts visible. Govern `unwrap`/`expect` contextually: request/business paths need typed errors; tests may use them for crisp failure; startup may use a narrowly justified fail-fast invariant. Avoid a lexical ban that rewards obscure equivalents.

## Conditional gates

Run only when configured or made applicable by accepted risk/NFR:

- `cargo nextest run`: existing nextest profile/tooling.
- `cargo sqlx prepare --check`: SQLx offline contract.
- `cargo audit` / `cargo deny`: configured dependency/security policy and advisory handling.
- `cargo test --doc`: public library/documentation contract.
- `proptest`: combinatorial invariants worth generative coverage.
- fuzzing: parsers, protocol boundaries or hostile input with a maintained corpus/target.
- mutation testing: critical logic where ordinary coverage cannot demonstrate assertion strength.
- Criterion/profiling/load: measurable performance NFR with representative environment and threshold.

Tool absence is `not-run` with the failed probe and limitation. Do not install a new gate, loosen its config or generate synthetic evidence merely to close a checklist.

## Review checklist

- Contract and error mapping match frozen acceptance.
- Ownership and clones reflect lifecycle rather than borrow-checker avoidance.
- No synchronous lock is held across `.await`; blocking work is isolated and bounded.
- Spawned tasks have ownership, cancellation, failure observation and shutdown behavior.
- Public errors and telemetry redact sensitive data.
- SQL constraints/transactions enforce invariants at the right authority.
- `unsafe` is absent or explicitly isolated, documented and tested.
- New traits/generics/layers have more than ceremonial value.
- No test was deleted, skipped, weakened or replaced to obtain GREEN.
