# PR verification evidence

Each row was tested from an isolated archive of the exact PR tree. #51 contains source readability changes only, and #47 contains the release workflow. `npm run compile`, `npm run lint`, `npm run test:unit` (8/8), and the full extension-host suite passed on both VS Code 1.146.0 and 1.74.3. The host suite asserts document text and editor selections.

| Merge order | PR head | Host tests on each VS Code version | Visual evidence |
|---|---|---:|---|
| [#44](https://github.com/bgashler1/vscode-htmltagwrap/pull/44) | `a33f80b066493569d51faaba2bc78beb48095f13` | 16/16 | [Before](pr44-bug.mp4) · [After](pr44-fix.mp4) · [Comparison](pr44-comparison.jpg) |
| [#45](https://github.com/bgashler1/vscode-htmltagwrap/pull/45) | `f540a420e3561a199b7ea5fa7ca436e021da21b0` | 23/23 | [Before](pr45-bug.mp4) · [After](pr45-fix.mp4) · [Comparison](pr45-comparison.jpg) |
| [#46](https://github.com/bgashler1/vscode-htmltagwrap/pull/46) | `60ad8483c7f2a694bb212c76f60e18ba830d8824` | 27/27 | [Before](pr46-bug.mp4) · [After](pr46-fix.mp4) · [Comparison](pr46-comparison.jpg) |
| [#48](https://github.com/bgashler1/vscode-htmltagwrap/pull/48) | `efff145ec7fbf3772fefba8f5ac3fab731623c46` | 35/35 | [Before](pr48-bug.mp4) · [After](pr48-fix.mp4) · [Comparison](pr48-comparison.jpg) |
| [#49](https://github.com/bgashler1/vscode-htmltagwrap/pull/49) | `8e3567d422b727f9e382e26bced4a5a3cfcba1cf` | 43/43 | [Before](pr49-bug.mp4) · [After](pr49-fix.mp4) · [Comparison](pr49-comparison.jpg) |
| [#50](https://github.com/bgashler1/vscode-htmltagwrap/pull/50) | `be585dd34569a4fdd15ca6d986ad5d46b131bc9c` | 48/48 | [Before](pr50-bug.mp4) · [After](pr50-fix.mp4) · [Comparison](pr50-comparison.jpg) |
| [#51](https://github.com/bgashler1/vscode-htmltagwrap/pull/51) | `8a3de82deaa161c61b319c714e4585f3ca3a4ca0` | 48/48 | Source cleanup with explanatory comments; no UI change |
| [#47](https://github.com/bgashler1/vscode-htmltagwrap/pull/47) | `4da9808d7c517c67b135e4cf9f5c0407d57abcb4` | 48/48 | VSIX package proof below |

## Recording method

The videos show the actual VS Code 1.146 editor from the parent and fixed PR heads. A temporary extension-host scenario set the input and invoked the command; Electron DevTools `Page.captureScreenshot` recorded 4 frames per second around the action. The capture harness is included in this branch as `capture.test.ts` and `record-cdp.js`. The videos were encoded with ffmpeg. No generated capture code was added to the extension PR diffs.

## Publishing package proof

On the exact #47 tree, `npx --yes @vscode/vsce@4.0.0 package --out htmltagwrap.vsix` succeeded after `.vscode-test` was excluded. The 20-file VSIX includes `extension/out/src/{extension,wrap,autoDeselectClosingTag,snippets,toggle}.js`, package metadata, and icon assets. It excludes tests, the workflow, and the downloaded VS Code editor. The rebased #47 tip passed compile, lint, unit, and host tests and produced a 20-file VSIX with SHA-256 `5360d08ccc961cc2f8784ee8c8bf5026775c0cb39a131a0bed4ba462fd50dbd1`. The workflow YAML parsed; `v1.0.0` passed its tag guard and `v1.0.1` failed it as expected. Actual registry publication requires repository secrets `VSCE_PAT` and `OVSX_PAT`.

## Reproduce host tests

At each PR head, run `npm ci`, `npm run compile`, `npm run lint`, `npm run test:unit`, then `VSCODE_TEST_VERSION=1.146.0 npm run test:LinuxAndOSX` and `VSCODE_TEST_VERSION=1.74.3 npm run test:LinuxAndOSX`. A display-capable macOS session or Linux `xvfb-run` is needed for the editor-host runs.
