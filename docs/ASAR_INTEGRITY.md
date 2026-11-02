# ASAR Integrity Check

**Date:** 2026-11-02  
**Input:** preserved original `app.asar`

## Results

- ASAR header parsed successfully.
- **59 packed files** were extracted and each file's SHA-256 digest matched the corresponding ASAR `integrity.hash` metadata.
- **0 integrity failures** were observed among packed files.
- **37 entries are marked `unpacked`** in the ASAR manifest. These entries are not stored inside the `app.asar` byte stream; Electron expects them in the sibling `app.asar.unpacked` directory.
- The GitHub repository tree inspected for this audit contains only `app.asar` and the ZIP snapshot; no `app.asar.unpacked` directory is tracked.

## Packaging consequence

A full application runtime cannot be reconstructed from this ASAR alone. The external `uiohook-napi` native module files, including the Windows x64 `.node` binary, must be recovered from the matching release package/source bundle before packaging or runtime testing can be considered valid. Do not fabricate empty placeholders for unpacked native files.
