import "dotenv/config";
import "reflect-metadata";
import { AppDataSource } from "../src/database/data-source";
import { User } from "../src/database/entities/User";
import { Project } from "../src/database/entities/Project";
import { ProjectsService } from "../src/modules/projects/projects.service";
import { SrsService } from "../src/modules/srs/srs.service";
import { ProposalsService } from "../src/modules/proposals/proposals.service";
import { PROJECT, REQUIREMENTS, SERVICES, SRS_BODIES } from "../src/seed/exeat360gh.data";

/** Loads the exeat360gh working scope as editable DRAFT records. No prices are set. Safe to re-run (skips if it exists). */
async function main() {
  const db = await AppDataSource();
  const user = await db.getRepository(User).findOne({ where: {}, order: { createdAt: "ASC" } });
  if (!user) throw new Error("Create the admin first: npm run seed:admin");
  const actor = { userId: user.id };

  if (await db.getRepository(Project).findOne({ where: { identifier: PROJECT.identifier, isDeleted: false } })) { console.log("exeat360gh already exists; nothing to do."); return; }

  const project = await ProjectsService.create(PROJECT, actor);
  for (const r of REQUIREMENTS) await ProjectsService.createRequirement(project.id, { priority: "must", ...r }, actor);

  const { document } = await SrsService.getOrCreate(project.id, actor);
  const sections = document.sections.map((s) => (SRS_BODIES[s.key] && !s.body.trim() ? { ...s, body: SRS_BODIES[s.key] } : s));
  await SrsService.save(project.id, { revision: document.revision, sections }, actor);

  const proposal = await ProposalsService.create({ projectId: project.id, title: "exeat360gh: Software Development Proposal" }, actor);
  await ProposalsService.saveDraft(proposal.id, {
    revision: proposal.draftRevision,
    pricing: {
      currency: proposal.currency,
      implementationFee: { amountMinor: null, confirmed: false, description: "To be determined after research and final scope confirmation." },
      paymentSchedule: [
        { label: "Before development begins", kind: "percent", percentBps: 5000, trigger: "before_development", condition: "Payable before development begins" },
        { label: "On completion, acceptance and handover", kind: "percent", percentBps: 5000, trigger: "on_acceptance_handover", condition: "According to the agreed completion, acceptance and handover terms" },
      ],
      services: SERVICES.map((s) => ({ ...s, provider: "", description: "", options: [], selectedOptionId: null, optional: false, clientSelectable: false })),
      maintenancePackages: [], otherRecurring: [], optionalEnhancements: [],
    },
  }, actor);
  console.log(`Created project "${project.name}", ${REQUIREMENTS.length} requirements, a requirements document draft and proposal ${proposal.reference} (draft). Review everything, set a client, fee and service prices, then publish.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
