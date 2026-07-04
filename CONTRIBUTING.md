# Contributing

Thanks for helping improve WeGit.

## Getting Started

```bash
git clone https://github.com/liao666brant/vscode-gitlens.git
cd vscode-gitlens
pnpm install
pnpm run build
```

Prerequisites:

- Git `>= 2.7.2`
- Node.js `>= 22.12.0`
- Corepack `>= 0.31.0`
- pnpm `>= 10.x`

## Development

Use these commands for normal development:

```bash
pnpm run watch
pnpm run check
pnpm run build:quick
pnpm run package
```

For a clean rebuild:

```bash
pnpm run rebuild
```

## Quality

Before sending a change, run:

```bash
pnpm run check
pnpm run build:quick
```

Run focused tests when touching behavior covered by tests.

## Pull Requests

Keep changes small and focused. Include documentation updates when the user-visible behavior changes.

This fork keeps the VS Code extension's historical internal command/config identifiers where compatibility requires them. Do not rename `gitlens.*` command or configuration IDs unless the change includes a compatibility migration.

## Releases

Build a local VSIX with:

```bash
pnpm run package
```

Automated publishing workflows from the upstream project are intentionally not part of this fork unless they are rebuilt for WeGit-owned credentials and package names.
