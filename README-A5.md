# A5 · Automated testing in CI/CD

This branch extends the existing A4 deployment workflow. The release asset is built once and reused unchanged throughout the pipeline.

`Build → Unit tests (Node 22/24) → Integration (staging/prod) → Dev → Staging → Release notes → Production`

- Unit: 7 existing template-engine checks; a 65% line coverage gate applies to `src/utils/templateEngine.js`. The log is uploaded separately for each Node version.
- Integration: the downloaded archive's SHA-256 is checked before extraction. The compiled Action uses a local HTTP fixture and dry-run mode; staging verifies Markdown and prod verifies HTML. Neither fixture can write to the repository.
- Release: the two test matrices must pass before any release can start. Dev and staging publish prereleases from the same archive. The A5 branch uses run-specific tags. The production environment is protected by GitHub Required reviewers.
- Dispatch: use `force_test_failure=false`, `publish_releases=true` for the success case. Then use both `true` for the negative case: staging integration intentionally expects issue #99 instead of #17. The test remains red; dev and staging must be skipped even when publishing was requested.
- Production review demo: on the A5 branch, set `request_production_review=true` together with `publish_releases=true` after the test passes. GitHub waits for the configured reviewer. After approval, the job only records the verified archive digest; it does not create a production release. On master, the actual production release remains disabled until `A5_PRODUCTION_ENABLED=true` is set after confirming production protection.

Repository: https://github.com/YiCheng429/activity-log
