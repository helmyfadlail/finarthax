import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseAllDocuments } from "yaml";

interface Manifest {
  kind: string;
  metadata: { name: string; namespace?: string };
  data?: Record<string, string>;
  stringData?: Record<string, string>;
  [key: string]: unknown;
}

const CLUSTER_SCOPED = new Set(["Namespace", "PersistentVolume"]);
const NAMESPACE = "finarthax";

export const parseManifests = (source: string): Manifest[] =>
  parseAllDocuments(source)
    .map((doc) => doc.toJS() as Manifest | null)
    .filter((doc): doc is Manifest => !!doc);

export const validateManifests = (manifests: Manifest[]): string[] => {
  const problems: string[] = [];

  if (manifests[0]?.kind !== "Namespace") problems.push(`first resource is ${manifests[0]?.kind ?? "missing"}, expected Namespace (namespaced resources would fail to apply)`);

  for (const m of manifests) {
    if (!CLUSTER_SCOPED.has(m.kind) && m.metadata.namespace !== NAMESPACE) problems.push(`${m.kind}/${m.metadata.name} is not in the ${NAMESPACE} namespace`);
  }

  const configMaps = new Map(manifests.filter((m) => m.kind === "ConfigMap").map((m) => [m.metadata.name, new Set(Object.keys(m.data ?? {}))]));
  const secrets = new Map(manifests.filter((m) => m.kind === "Secret").map((m) => [m.metadata.name, new Set([...Object.keys(m.stringData ?? {}), ...Object.keys(m.data ?? {})])]));

  const walk = (node: unknown, owner: string) => {
    if (Array.isArray(node)) return node.forEach((item) => walk(item, owner));
    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    for (const [refKind, table] of [
      ["configMapKeyRef", configMaps],
      ["secretKeyRef", secrets],
    ] as const) {
      const ref = record[refKind] as { name: string; key: string } | undefined;
      if (ref && !table.get(ref.name)?.has(ref.key)) problems.push(`${owner}: ${refKind} ${ref.name}/${ref.key} does not exist`);
    }

    Object.values(record).forEach((value) => walk(value, owner));
  };

  for (const m of manifests) if (m.kind === "Deployment" || m.kind === "CronJob") walk(m, `${m.kind}/${m.metadata.name}`);

  return problems;
};

const main = () => {
  const file = process.argv[2];
  const source = file ? readFileSync(file, "utf8") : execFileSync("kubectl", ["kustomize", "k8s/"], { encoding: "utf8" });
  const manifests = parseManifests(source);
  const problems = validateManifests(manifests);

  if (problems.length > 0) {
    console.error(`✖ ${problems.length} problem(s) in the Kubernetes manifests:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    process.exit(1);
  }

  console.log(`✔ ${manifests.length} resources: Namespace first, all in "${NAMESPACE}", every config/secret key reference resolves`);
};

if (process.argv[1]?.endsWith("validate-k8s.ts")) main();
