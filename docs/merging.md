# Merging Strategy & Git Workflow

## Overview
We use two primary merge methods:
- **Squash & merge** (default)
- **Merge commit (no fast-forward)** for large/multi-dev features

We do **not** allow "Rebase & merge" on the remote. Rebasing is only done locally.

---

## Repo Settings

### Merge Options
- Enable: **Squash merging**
- Enable: **Create a merge commit**
- Disable: **Rebase and merge**
- Optional: Auto-delete head branches after merge

### Branch Protection (main)
- Require pull request before merging (1–2 reviews)
- Dismiss stale approvals on new commits
- Require status checks to pass before merging
- Require branches to be up-to-date before merging
- Require conversation resolution before merging
- Do not require linear history
- Restrict who can push to `main`

---

## Local Git Defaults
```
git config --global rerere.enabled true
git config --global pull.ff only
```

## Default Path — Small/Normal PRs (Squash & merge)
1. Branch from main:
```git switch -c feature/short-desc```
2. Keep fresh while coding (solo branch):
``git fetch origin && git rebase origin/main``
3. Open PR → CI green → Squash & merge.
4. Write a clear squash commit message:
```
feat: add avatar upload

    adds S3 presigned upload

    validates mime & size

    updates profile page UI
```
