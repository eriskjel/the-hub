# Merging Strategy & Git Workflow

## Overview

We use a single long-lived branch, **`main`**. All work lands via pull requests:

- **Feature branch → `main`**: **Squash & merge** (default for all PRs)

We do **not** allow "Rebase & merge" on the remote. Rebasing is only done locally for keeping feature branches up-to-date.

---

## Repo Settings

### Branch Protection / Rulesets

**`main`**
- Allowed merge methods: **Squash** only
- Require pull request before merging (1–2 reviews)
- Dismiss stale approvals on new commits
- Require status checks to pass before merging
- Require conversation resolution before merging
- Restrict who can push to `main`

---

## Local Git Defaults

```bash
git config pull.ff only               # no accidental merge commits on pull
git config pull.rebase true           # rebase your local feature branches on pull
git config branch.main.rebase false   # main uses FF-only on pull
git config rerere.enabled true        # reuse conflict resolutions
```
