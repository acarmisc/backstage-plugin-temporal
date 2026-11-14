# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | :white_check_mark: |
| 0.2.x   | :x:         |

## Disclosed Vulnerabilities

This plugin's published packages (temporal-common, temporal-backend, temporal) have **no high or critical security issues** in Snyk composition analysis.

The following applications that *consume* this plugin may have transitive dependencies with reported findings:

### Example Frontend Application (`packages/app`)
- **undici@7.29.0**: 20 high/critical issues (Snyk Open Source)
  - Fixed in: 7.29.1, 8.10.2, 8.12.2, 8.12.4
  - Introduced via: `@backstage/cli` dependency chain
  - Recommendation: Update `@backstage/cli` or add yarn resolution for undici

- **react-dev-utils@12.0.1**: 2 critical issues (Command Injection, Improper Certificate Validation)
  - No direct Snyk fix; consider Backstage framework update

### Example Backend Application (`packages/backend`)
- **tar@6.2.1**: 4 high issues (Directory Traversal, Symlink Attack, Infinite loop, Resource throttling)
  - Fixed in: 6.2.1+ patches available
  - Introduced via: `node-gyp` > `make-fetch-happen` > `cacache` > `tar`

- **@graphql-tools/utils@8.13.1**: 1 high issue (Prototype Pollution)
  - Fixed in: 12.0.1

- **braces@3.0.3**: 2 high issues (Uncontrolled Recursion, Prototype Pollution)
  - Fixed in: 3.0.4+

- **basic-ftp@5.3.1**: 1 high issue (ReDoS)
  - No direct upgrade; monitor

### Snyk Code
- **X-Powered-By header exposure** in `plugins/temporal-backend/src/router.test.ts`
  - Recommendation: Remove header setting in test utilities

## Security Practices

- Run `yarn snyk test` periodically
- Keep `@backstage/*` dependencies updated
- Monitor Snyk alerts via GitHub Actions
- For production deployments, evaluate runtime threat model separately

## Reporting Vulnerabilities

Please report security issues via GitHub Issues with the `security` label. Do not disclose publicly until a fix is released.