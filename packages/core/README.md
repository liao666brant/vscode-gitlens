# @gitkraken/core-gitlens

Shared Git primitives from [GitLens](https://github.com/gitkraken/vscode-gitlens).

This package flattens the MIT-licensed workspace packages into a single tarball:

| Subpath     | Source package     | License       |
| ----------- | ------------------ | ------------- |
| `utils/*`   | `@gitlens/utils`   | See `LICENSE` |
| `git/*`     | `@gitlens/git`     | See `LICENSE` |
| `git-cli/*` | `@gitlens/git-cli` | See `LICENSE` |

## Usage

```ts
import { Logger } from '@gitkraken/core-gitlens/utils/logger.js';
import { GitService } from '@gitkraken/core-gitlens/git/service.js';
import { Repository } from '@gitkraken/core-gitlens/git/models/repository.js';
import { CliGitProvider } from '@gitkraken/core-gitlens/git-cli/cliGitProvider.js';
```

All exports are fully typed and source-mapped back to the original TypeScript sources shipped in `src/`.

### Node vs browser

`utils/` uses internal `#env/*` imports that resolve differently based on the target:

- Node: `dist/utils/env/node/*.js`
- Browser / webworker bundlers (webpack, Vite, esbuild, Rspack): `dist/utils/env/browser/*.js`

No consumer configuration required — the runtime / bundler picks the right variant automatically via the package's `"imports"` field.

### Tree-shaking

The package is marked `"sideEffects": false` and uses per-file subpath exports.

## Licensing

`LICENSE` governs all bundled package contents.

## Versioning

Independent from the [GitLens VS Code extension](https://github.com/gitkraken/vscode-gitlens). Breaking changes may happen on any minor bump while the package is `0.x`.

## Source

Built from the `packages/` workspace of [vscode-gitlens](https://github.com/gitkraken/vscode-gitlens). See `packages/core/scripts/bundle.mjs` in that repo for the flattening logic.
