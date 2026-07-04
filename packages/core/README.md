# @liao666brant/core-wegit

Shared Git primitives for WeGit.

This package flattens the MIT-licensed workspace packages into a single tarball:

| Subpath     | Source workspace   | License       |
| ----------- | ------------------ | ------------- |
| `utils/*`   | `packages/utils`   | See `LICENSE` |
| `git/*`     | `packages/git`     | See `LICENSE` |
| `git-cli/*` | `packages/git-cli` | See `LICENSE` |

## Usage

```ts
import { Logger } from '@liao666brant/core-wegit/utils/logger.js';
import { GitService } from '@liao666brant/core-wegit/git/service.js';
import { Repository } from '@liao666brant/core-wegit/git/models/repository.js';
import { CliGitProvider } from '@liao666brant/core-wegit/git-cli/cliGitProvider.js';
```

All exports are fully typed and source-mapped back to the original TypeScript sources shipped in `src/`.

## Node vs Browser

`utils/` uses internal `#env/*` imports that resolve differently based on the target:

- Node: `dist/utils/env/node/*.js`
- Browser / webworker bundlers: `dist/utils/env/browser/*.js`

No consumer configuration required. The runtime or bundler picks the right variant via the package's `"imports"` field.

## Licensing

`LICENSE` governs all bundled package contents.

## Versioning

Independent from the WeGit VS Code extension. Breaking changes may happen on any minor bump while the package is `0.x`.

## Source

Built from the `packages/` workspace of this repository. See `packages/core/scripts/bundle.mjs` for the flattening logic.
