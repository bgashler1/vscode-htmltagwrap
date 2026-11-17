# Publishing

The `Publish extension` GitHub Actions workflow runs when a `v*` tag is pushed to this repository. The tag must match `v` plus the version in `package.json`. For example, version `1.0.1` uses tag `v1.0.1`.

Set these repository Actions secrets before tagging a release:

- `VSCE_PAT`: Visual Studio Marketplace publisher token for `bradgashler`.
- `OVSX_PAT`: Open VSX personal access token authorized for the `bradgashler` namespace.

The workflow runs the extension suite on an older VS Code release and the current stable release, packages one VSIX, and publishes that same file to both registries. Both publish commands skip versions that are already present, so a failed job can be rerun without publishing a second version.
