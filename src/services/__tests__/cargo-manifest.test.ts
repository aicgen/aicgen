import { mergeCargoManifests, parseCargoManifest } from '../cargo-manifest.js';

describe('parseCargoManifest', () => {
  it('reads package metadata and dependency names from every section', () => {
    const info = parseCargoManifest(`
[package]
name = "myapp"
version = "0.1.0"
edition = "2024"
rust-version = "1.88"

[dependencies]
axum = "0.8"
serde = { version = "1", features = ["derive"] } # trailing comment
tokio.workspace = true

[dev-dependencies]
proptest = "1"

[build-dependencies]
cc = "1"

[target.'cfg(unix)'.dependencies]
libc = "0.2"

[dependencies.sqlx]
version = "0.8"
`);

    expect(info.name).toBe('myapp');
    expect(info.edition).toBe('2024');
    expect(info.rustVersion).toBe('1.88');
    expect([...info.dependencies].sort()).toEqual(['axum', 'cc', 'libc', 'serde', 'sqlx', 'tokio']);
    expect([...info.devDependencies]).toEqual(['proptest']);
    expect(info.isWorkspace).toBe(false);
  });

  it('detects workspaces and inherited package settings', () => {
    const info = parseCargoManifest(`
[workspace]
members = ["crates/*"]
resolver = "3"

[workspace.package]
edition = "2024"
rust-version = "1.88"

[workspace.dependencies]
clap = { version = "4", features = ["derive"] }
`);

    expect(info.isWorkspace).toBe(true);
    expect(info.edition).toBe('2024');
    expect(info.rustVersion).toBe('1.88');
    expect(info.dependencies.has('clap')).toBe(true);
  });

  it('detects lib and bin targets', () => {
    const info = parseCargoManifest('[lib]\nname = "x"\n\n[[bin]]\nname = "y"\npath = "src/y.rs"\n');

    expect(info.hasLibTarget).toBe(true);
    expect(info.hasBinTarget).toBe(true);
  });

  it('ignores keys outside dependency sections and malformed lines', () => {
    const info = parseCargoManifest('[features]\ndefault = ["serde"]\n\n[profile.release]\nlto = true\n???\n');

    expect(info.dependencies.size).toBe(0);
  });

  it('merges several manifests', () => {
    const merged = mergeCargoManifests([
      parseCargoManifest('[workspace]\nmembers = ["a"]\n'),
      parseCargoManifest('[package]\nname = "a"\nedition = "2024"\n[dependencies]\nclap = "4"\n'),
      parseCargoManifest('[package]\nname = "b"\n[dev-dependencies]\ninsta = "1"\n'),
    ]);

    expect(merged.isWorkspace).toBe(true);
    expect(merged.name).toBe('a');
    expect(merged.edition).toBe('2024');
    expect(merged.dependencies.has('clap')).toBe(true);
    expect(merged.devDependencies.has('insta')).toBe(true);
  });
});
