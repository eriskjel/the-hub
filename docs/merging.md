# Merging Strategy & Git Workflow

## Overview
We use one primary merge method:
- **Squash & merge** (default for all PRs)

We do **not** allow "Rebase & merge" on the remote. Rebasing is only done locally for keeping feature branches up-to-date.

---

## Repo Settings

### Merge Options
- Enable: **Squash merging**
- Disable: **Create a merge commit**
- Disable: **Rebase and merge**
- Optional: Auto-delete head branches after merge

### Branch Protection (main)
- Require pull request before merging (1–2 reviews)
- Dismiss stale approvals on new commits
- Require status checks to pass before merging
- Require branches to be up-to-date before merging
- Require conversation resolution before merging
- Require linear history
- Restrict who can push to `main`

---

## Local Git Defaults
```
git config pull.ff only               # no accidental merge commits on pull
git config pull.rebase true           # rebase your local feature branches on pull
git config branch.main.rebase false   # main uses FF-only on pull
git config rerere.enabled true        # reuse conflict resolutions

```

## Default Path — Small/Normal PRs (Squash & merge)
1. Branch from main:
```
git switch main
git fetch origin && git pull
git switch -c short-desc
```
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
5. After merge:
```
git switch main
git fetch origin && git pull
git branch -d short-desc
```