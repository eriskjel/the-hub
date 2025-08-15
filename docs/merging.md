# Merging Strategy & Git Workflow

## Overview
We use two primary merge methods depending on the PR type:

- **Feature → `dev`**: **Squash & merge** (default for all feature PRs)
- **`dev` → `main`**: **Merge commit (no fast-forward)**

We do **not** allow "Rebase & merge" on the remote. Rebasing is only done locally for keeping feature branches up-to-date.

---

## Repo Settings

### Branch Protection / Rulesets

**`dev`**
- Allowed merge methods: **Squash** only
- Require pull request before merging (1–2 reviews)
- Dismiss stale approvals on new commits
- Require status checks to pass before merging
- Require conversation resolution before merging

**`main`**
- Allowed merge methods: **Merge commit** only
- Require pull request before merging (1–2 reviews)
- Dismiss stale approvals on new commits
- Require status checks to pass before merging
- Require conversation resolution before merging
- Require branches to be up-to-date before merging
- Do **not** require linear history (merge commits are non-linear)
- Restrict who can push to `main`

---

## Local Git Defaults
```bash
git config pull.ff only               # no accidental merge commits on pull
git config pull.rebase true           # rebase your local feature branches on pull
git config branch.main.rebase false   # main uses FF-only on pull
git config branch.dev.rebase false    # dev uses FF-only on pull
git config rerere.enabled true        # reuse conflict resolutions
