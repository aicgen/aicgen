/**
 * Minimal Cargo.toml reader. It extracts only what aicgen needs (edition,
 * MSRV, workspace/bin/lib presence and dependency names) without a TOML
 * dependency. It is deliberately forgiving: unknown syntax is ignored.
 */
export interface CargoManifestInfo {
  name?: string;
  edition?: string;
  rustVersion?: string;
  isWorkspace: boolean;
  hasBinTarget: boolean;
  hasLibTarget: boolean;
  /** Names from [dependencies], [dev-dependencies], [build-dependencies], [workspace.dependencies] and target tables. */
  dependencies: Set<string>;
  devDependencies: Set<string>;
}

const DEP_SECTION = /^(?:target\.[^\]]+\.)?(dependencies|dev-dependencies|build-dependencies)$/;

export function parseCargoManifest(text: string): CargoManifestInfo {
  const info: CargoManifestInfo = {
    isWorkspace: false,
    hasBinTarget: false,
    hasLibTarget: false,
    dependencies: new Set(),
    devDependencies: new Set(),
  };

  let section = '';

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;

    const header = line.match(/^\[\[?\s*([^\]]+?)\s*\]\]?$/);
    if (header) {
      section = header[1];

      if (section === 'workspace') info.isWorkspace = true;
      if (section === 'lib') info.hasLibTarget = true;
      if (section === 'bin') info.hasBinTarget = true;

      // [dependencies.serde] style tables name the dependency in the header
      const tableDep = section.match(/^(?:target\.[^\]]+\.)?(dependencies|dev-dependencies|build-dependencies)\.(.+)$/)
        ?? section.match(/^workspace\.(dependencies)\.(.+)$/);
      if (tableDep) {
        addDependency(info, tableDep[1], tableDep[2].replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    const keyValue = line.match(/^([A-Za-z0-9_.\-"']+)\s*=\s*(.*)$/);
    if (!keyValue) continue;
    const key = keyValue[1].replace(/["']/g, '');
    const value = keyValue[2].trim().replace(/^["']|["']$/g, '');

    if (section === 'package') {
      if (key === 'name') info.name = value;
      if (key === 'edition') info.edition = value;
      if (key === 'rust-version') info.rustVersion = value;
      continue;
    }

    if (section === 'workspace.package') {
      if (key === 'edition') info.edition ??= value;
      if (key === 'rust-version') info.rustVersion ??= value;
      continue;
    }

    const depSection = section.match(DEP_SECTION)?.[1] ?? (section === 'workspace.dependencies' ? 'dependencies' : undefined);
    if (depSection) {
      // `serde.workspace = true` and `serde = "1"` both name `serde`
      addDependency(info, depSection, key.split('.')[0]);
    }
  }

  return info;
}

function addDependency(info: CargoManifestInfo, section: string, name: string): void {
  if (section === 'dev-dependencies') {
    info.devDependencies.add(name);
  } else {
    info.dependencies.add(name);
  }
}

export function mergeCargoManifests(manifests: CargoManifestInfo[]): CargoManifestInfo {
  const merged: CargoManifestInfo = {
    isWorkspace: false,
    hasBinTarget: false,
    hasLibTarget: false,
    dependencies: new Set(),
    devDependencies: new Set(),
  };

  for (const manifest of manifests) {
    merged.name ??= manifest.name;
    merged.edition ??= manifest.edition;
    merged.rustVersion ??= manifest.rustVersion;
    merged.isWorkspace ||= manifest.isWorkspace;
    merged.hasBinTarget ||= manifest.hasBinTarget;
    merged.hasLibTarget ||= manifest.hasLibTarget;
    manifest.dependencies.forEach(d => merged.dependencies.add(d));
    manifest.devDependencies.forEach(d => merged.devDependencies.add(d));
  }

  return merged;
}

export const RUST_FRAMEWORKS: Record<string, string> = {
  axum: 'Axum',
  'actix-web': 'Actix Web',
  rocket: 'Rocket',
  warp: 'Warp',
  poem: 'Poem',
  tonic: 'tonic (gRPC)',
  tokio: 'Tokio',
  'async-std': 'async-std',
  clap: 'clap',
  tauri: 'Tauri',
  bevy: 'Bevy',
  leptos: 'Leptos',
  yew: 'Yew',
  dioxus: 'Dioxus',
  'wasm-bindgen': 'wasm-bindgen',
  'embassy-executor': 'Embassy',
  'cortex-m': 'cortex-m (embedded)',
  rdkafka: 'Kafka',
  lapin: 'RabbitMQ',
};

export const RUST_TEST_TOOLS: Record<string, string> = {
  proptest: 'proptest',
  quickcheck: 'quickcheck',
  insta: 'insta (snapshots)',
  rstest: 'rstest',
  mockall: 'mockall',
  criterion: 'criterion',
  divan: 'divan',
  assert_cmd: 'assert_cmd',
  wiremock: 'wiremock',
  testcontainers: 'Testcontainers',
};

export const RUST_SQL_CRATES = ['sqlx', 'diesel', 'sea-orm', 'rusqlite', 'tokio-postgres', 'postgres', 'mysql_async', 'mysql', 'tiberius'];
export const RUST_NOSQL_CRATES = ['mongodb', 'redis', 'aws-sdk-dynamodb', 'scylla', 'cassandra-cpp'];
