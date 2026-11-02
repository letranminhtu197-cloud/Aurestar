# GitHub Actions — Windows CI

Workflow file: .github/workflows/windows-build.yml

## What it does

- Runs on pushes to main, develop, audit branches and release branches; on pull requests to main or develop; and by manual dispatch.
- Uses a Windows runner and Node.js 22.
- Extracts the checked-in app.asar, applies the reviewed null-selector correction in a temporary workspace, and runs source-level regression and JavaScript syntax tests.
- Uploads a recovered-source snapshot and a build-readiness report as the aurestar-windows-ci-audit artifact.
- Builds Windows Setup and Portable executables only when a complete root source checkout, lockfile, pinned Electron/electron-builder configuration, and required background resources are present.
- Never fabricates an EXE or reports a skipped installer build as successful.

## Current expected result

The current repository has an ASAR and a version ZIP, but no root package.json, package-lock.json, editable root Electron source tree or verified packaging configuration. The installer job will therefore be skipped and the workflow will explain the missing prerequisites. This is intentional until the original build configuration and background resources are recovered.

## Run it

Open the repository's Actions tab, select Aurestar Windows CI, then choose Run workflow. The workflow also runs automatically for the configured branch and pull-request events.

## Artifacts

- aurestar-windows-ci-audit: recovered editable source snapshot and build status.
- Aurestar-Windows-Installers: appears only after a valid Windows package build has actually completed.
