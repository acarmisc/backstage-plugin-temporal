# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | :white_check_mark: |
| 0.2.x   | :x:         |

## Disclosed Vulnerabilities

This plugin's published packages (temporal-common, temporal-backend, temporal) have **no high or critical security issues** in Snyk composition analysis.

The following applications that *consume* this plugin may have transitive dependencies with reported findings:

### Step 1: Security policy document
- **Status**: ✅ Completed (0.3.1 release)
- **Action**: Added SECURITY.md with supported versions, disclosed vulnerabilities, and reporting guidelines
- **Release**: Plugin packages bumped to 0.3.1

### Step 2: undici vulnerabilities (frontend app) - In Progress
- **Issues**: 20 high/critical in undici@7.29.0 (via @backstage/cli chain)
- **Snyk fixes**: Upgrade to undici@7.30.2+, 8.10.2+, or 8.12.2+
- **Action for consumers**: Add yarn resolution `{"undici": "8.12.2"}` to `package.json` or update `@backstage/cli` to a version that brings undici 8.12.2+
- **Release**: 0.3.2 (checkpoint) - documents the upgrade path; actual dependency update is consumer-side
- **Note**: undici 7.x→8.x is a major version jump with API changes; consumers should test thoroughly

### Step 3: Fix backend dependency issues (tar, @graphql-tools/utils, braces, basic-ftp) - Planned
- **Issues**: 8 high in packages/backend
  - tar: Directory Traversal, Symlink Attack, Infinite loop, Resource throttling
  - @graphql-tools/utils: Prototype Pollution
  - braces: Uncontrolled Recursion, Prototype Pollution
  - basic-ftp: ReDoS (no direct upgrade)
- **Action**: Upgrade introducing dependencies where upgrades exist (tar→6.2.1+, @graphql-tools-utils→12.0.1+, braces→3.0.4+); for no-direct-upgrade issues, add exclusions or sanitization notes
- **Release**: 0.3.4 after fixes verified

### Step 4: Fix remaining frontend issues (adm-zip, react-router, uri-js, react-dev-utils) - Planned
- **adm-zip**: 6 high issues - upgrade to 0.6.1 (fixes all)
- **react-router**: Upgrade to 7.18.0 (fixes open redirect)
- **uri-js**: Upgrade to 4.4.2+ (fixes 1 issue)
- **react-dev-utils**: No direct Snyk fix; consider Backstage framework update
- **Release**: 0.3.5 after fixes verified

### Step 5: Snyk Code fix
- **Issue**: X-Powered-By header exposure in router.test.ts
- **Fix**: Remove or comment out the header setting in the test Express app
- **Release**: 0.3.6 after fix

### Step 6: Final verification and release
- Run full CI (type-check, lint, test, build)
- New Snyk scan
- Tag final release

## Security Practices

- Run `yarn snyk test` periodically
- Keep `@backstage/*` dependencies updated
- Monitor Snyk alerts via GitHub Actions
- For production deployments, evaluate runtime threat model separately

## Reporting Vulnerabilities

Please report security issues via GitHub Issues with the `security` label. Do not disclose publicly until a fix is released.