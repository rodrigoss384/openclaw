import fs from "node:fs";
import path from "node:path";
import { validateJsonSchema, validateSchemaSupport } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";

export const FINDING_CLASSES = [
  "spatial-density",
  "surface-layering",
  "surface-economy",
  "accent-overuse",
  "semantic-color",
  "semantic-presentation",
  "text-hierarchy",
  "interaction-affordance",
  "system-status-visibility",
  "control-presence",
  "empty-recovery",
  "wayfinding",
  "information-scent",
  "reference-utility",
  "responsive-composition",
  "content-clarity"
];

const FINDING_SOURCES = new Set([
  "impeccable-detector",
  "impeccable-critique",
  "objective-audit",
  "manual-review"
]);
const DEFECT_KINDS = new Set(["implementation", "contract"]);
const COMMAND_GROUPS = [
  "managed",
  "findingDriven",
  "explicitApproval",
  "strongExplicitApproval",
  "designSystemMaintenanceOnly"
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function unique(values) {
  return [...new Set(values)];
}

function commandGovernance(policy, command) {
  if (!command) return null;
  const nonCanonical = new Set(policy?.commands?.notCanonicalInManagedWorkflow || []);
  if (nonCanonical.has(command)) {
    throw new Error(`Finding router cannot return non-canonical provider command '${command}'.`);
  }
  for (const group of COMMAND_GROUPS) {
    if ((policy?.commands?.[group] || []).includes(command)) {
      return {
        name: command,
        governance: group,
        requiresExplicitApproval: group === "explicitApproval" || group === "strongExplicitApproval"
      };
    }
  }
  throw new Error(`Finding router references provider command '${command}' that is not governed by frontend-craft-policy.json.`);
}

function validateFindingInput(finding) {
  const errors = [];
  if (!finding || typeof finding !== "object" || Array.isArray(finding)) return ["finding must be an object"];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(finding.id || "")) errors.push("finding.id must be a kebab-case id");
  if (!FINDING_CLASSES.includes(finding.class)) errors.push(`finding.class must be one of the governed taxonomy classes: ${FINDING_CLASSES.join(", ")}`);
  if (!DEFECT_KINDS.has(finding.defectKind)) errors.push("finding.defectKind must be implementation or contract");
  if (typeof finding.summary !== "string" || !finding.summary.trim()) errors.push("finding.summary must be non-empty");
  if (!FINDING_SOURCES.has(finding.source)) errors.push("finding.source must be impeccable-detector, impeccable-critique, objective-audit, or manual-review");
  if (finding.severity != null && !["p0", "p1", "p2", "p3", "info"].includes(finding.severity)) errors.push("finding.severity is not governed");
  return errors;
}

function loadRouteSchema(root, policy) {
  const schemaPath = path.resolve(root, policy.findingRouter.schema);
  if (!fs.existsSync(schemaPath)) throw new Error(`Finding route schema not found: ${schemaPath}`);
  const schema = readJson(schemaPath);
  const supportErrors = validateSchemaSupport(schema);
  if (supportErrors.length) throw new Error(`Finding route schema uses unsupported keywords:\n- ${supportErrors.join("\n- ")}`);
  return { schema, schemaPath };
}

function classRoute(policy, findingClass) {
  const route = policy?.findingRouter?.classes?.[findingClass];
  if (!route) throw new Error(`No finding-router policy exists for '${findingClass}'.`);
  return route;
}

export function routeFinding({ root, policy, finding }) {
  const inputErrors = validateFindingInput(finding);
  if (inputErrors.length) throw new Error(`Invalid normalized finding:\n- ${inputErrors.join("\n- ")}`);

  if (policy?.findingRouter?.classification !== "explicit-taxonomy-no-free-text-inference") {
    throw new Error("Finding router classification policy must be explicit-taxonomy-no-free-text-inference.");
  }

  const definition = classRoute(policy, finding.class);
  const defectKind = finding.defectKind;
  const owner = defectKind === "implementation" ? definition.implementationOwner : definition.contractOwner;
  const returnStage = policy.findingRouter.returnStageByDefectKind?.[defectKind];
  const repairStrategy = policy.findingRouter.repairStrategyByDefectKind?.[defectKind];
  if (!returnStage || !repairStrategy) throw new Error(`Finding-router defect-kind policy is incomplete for '${defectKind}'.`);

  const providerCommand = defectKind === "implementation"
    ? commandGovernance(policy, definition.providerCommand)
    : null;

  const revalidationSet = unique([
    ...(defectKind === "contract" ? ["frontend-readiness"] : []),
    ...(definition.revalidationSet || [])
  ]);

  const rationale = defectKind === "contract"
    ? `The '${finding.class}' finding is classified as a canonical contract defect. Return to DESIGN_READINESS, repair only the affected canonical contracts under ${owner}, then rerun the declared revalidation set. Provider repair commands are suppressed for contract defects.`
    : `The '${finding.class}' finding is classified as an implementation defect against approved contracts. Repair only the implementation under ${owner}; any returned Impeccable command is bounded by its command-governance class and cannot redefine canonical contracts.`;

  const report = {
    $schema: "finding-route.schema.json",
    schemaVersion: "1.0.0",
    generated: true,
    generatedAt: new Date().toISOString(),
    finding: {
      id: finding.id,
      class: finding.class,
      defectKind: finding.defectKind,
      summary: finding.summary,
      source: finding.source,
      ...(finding.severity ? { severity: finding.severity } : {}),
      ...(finding.target ? { target: finding.target } : {}),
      ...(finding.sourceArtifact ? { sourceArtifact: finding.sourceArtifact } : {})
    },
    route: {
      class: finding.class,
      owner,
      affectedContracts: [...definition.affectedContracts],
      repairStrategy,
      providerCommand,
      returnStage,
      revalidationSet,
      rationale
    }
  };

  const { schema } = loadRouteSchema(root, policy);
  const schemaErrors = validateJsonSchema(report, schema);
  if (schemaErrors.length) throw new Error(`Generated finding route is invalid:\n- ${schemaErrors.join("\n- ")}`);
  return report;
}

export function routeFindingToFile({ root, policy, findingPath, outputPath }) {
  const finding = readJson(findingPath);
  const report = routeFinding({ root, policy, finding });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
