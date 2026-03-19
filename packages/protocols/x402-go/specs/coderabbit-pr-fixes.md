# CodeRabbit PR Fixes

## Overview

Check for open PR from current branch, fetch unresolved coderabbitai[bot] comments, create tasks, fix issues.

## User Story

Developer wants to quickly address all CodeRabbit review feedback without manually copying comments.

## Requirements

- Detect open PR from current git branch via `gh pr view`
- Fetch all review comments from `coderabbitai[bot]`
- Filter to unresolved comments only
- Skip comments referencing deleted/non-existent code
- Create actionable tasks from each comment
- Fix each issue

## Technical Implementation

Use `gh` CLI:
- `gh pr view --json number,state` - check PR exists
- `gh api repos/{owner}/{repo}/pulls/{pr}/comments` - fetch comments
- Filter by `user.login == "coderabbitai[bot]"` and unresolved state

## Tasks

### 1. Fetch and fix CodeRabbit comments
- [ ] Check for open PR from current branch, fetch unresolved coderabbitai[bot] comments, create tasks for issues, fix them

## Out of Scope

- Creating PRs
- Resolving comment threads automatically
- Non-CodeRabbit review comments

## Open Questions

None
