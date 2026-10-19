import type {
  AnalysisRun as AnalysisRunRow,
  Contract as ContractRow,
  ContractVersion as ContractVersionRow,
  Finding as FindingRow,
  Prisma,
  PrismaClient,
  Project as ProjectRow,
} from "@prisma/client";
import {
  CHANGE_TYPES,
  FINDING_CATEGORIES,
  RISK_LEVELS,
  type ChangeType,
  type ContractFormat,
  type FindingCategory,
  type RiskLevel,
} from "@contract-ripple/shared";
import { toContractSummary, toStringArray } from "./json.js";
import type {
  AnalysisRunDetailRecord,
  AnalysisRunRecord,
  AnalysisRunWithVersions,
  ContractRecord,
  ContractRecordWithCount,
  ContractVersionRecord,
  ContractVersionWithContract,
  CreateAnalysisRunInput,
  CreateContractInput,
  CreateContractVersionInput,
  CreateProjectInput,
  FindingRecord,
  ProjectRecord,
  ProjectRecordWithCount,
  Repository,
  UpdateProjectInput,
} from "./types.js";

type ProjectRowWithCount = ProjectRow & { _count: { contracts: number } };
type ContractRowWithCount = ContractRow & { _count: { versions: number } };
type AnalysisRowWithVersions = AnalysisRunRow & {
  baselineVersion: ContractVersionRow;
  candidateVersion: ContractVersionRow;
};
type AnalysisRowDetail = AnalysisRunRow & {
  baselineVersion: ContractVersionRow & { contract: ContractRow };
  candidateVersion: ContractVersionRow & { contract: ContractRow };
  findings: FindingRow[];
};

function assertOneOf<T extends string>(value: string, allowed: readonly T[], field: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`Stored finding ${field} value is not recognised.`);
  }
  return value as T;
}

function toFormat(value: string): ContractFormat {
  return value === "json" ? "json" : "yaml";
}

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapProjectWithCount(row: ProjectRowWithCount): ProjectRecordWithCount {
  return { ...mapProject(row), contractCount: row._count.contracts };
}

function mapContract(row: ContractRow): ContractRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapContractWithCount(row: ContractRowWithCount): ContractRecordWithCount {
  return { ...mapContract(row), versionCount: row._count.versions };
}

function mapVersion(row: ContractVersionRow): ContractVersionRecord {
  return {
    id: row.id,
    contractId: row.contractId,
    label: row.label,
    format: toFormat(row.format),
    rawContent: row.rawContent,
    checksum: row.checksum,
    openapiVersion: row.openapiVersion,
    title: row.title,
    infoVersion: row.infoVersion,
    warnings: toStringArray(row.warnings),
    createdAt: row.createdAt,
  };
}

function mapFinding(row: FindingRow): FindingRecord {
  return {
    id: row.id,
    analysisRunId: row.analysisRunId,
    position: row.position,
    engineId: row.engineId,
    category: assertOneOf(row.category, FINDING_CATEGORIES, "category") as FindingCategory,
    changeType: assertOneOf(row.changeType, CHANGE_TYPES, "changeType") as ChangeType,
    risk: assertOneOf(row.risk, RISK_LEVELS, "risk") as RiskLevel,
    path: row.path,
    method: row.method,
    operationId: row.operationId,
    location: row.location,
    summary: row.summary,
    explanation: row.explanation,
    before: row.before,
    after: row.after,
    createdAt: row.createdAt,
  };
}

function mapAnalysisRun(row: AnalysisRunRow): AnalysisRunRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    baselineVersionId: row.baselineVersionId,
    candidateVersionId: row.candidateVersionId,
    label: row.label,
    status: row.status,
    truncated: row.truncated,
    totalFindings: row.totalFindings,
    nonBreakingCount: row.nonBreakingCount,
    potentiallyBreakingCount: row.potentiallyBreakingCount,
    unknownCount: row.unknownCount,
    durationMs: row.durationMs,
    limitations: toStringArray(row.limitations),
    baselineSummary: toContractSummary(row.baselineSummary),
    candidateSummary: toContractSummary(row.candidateSummary),
    createdAt: row.createdAt,
  };
}

function toSummaryJson(summary: {
  openapi: string;
  title?: string;
  version?: string;
  warnings: string[];
}): Prisma.InputJsonObject {
  return {
    openapi: summary.openapi,
    title: summary.title ?? null,
    version: summary.version ?? null,
    warnings: summary.warnings,
  };
}

/** Prisma-backed implementation of the API persistence boundary. */
export class PrismaRepository implements Repository {
  constructor(private readonly prisma: PrismaClient) {}

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const row = await this.prisma.project.create({
      data: { name: input.name, description: input.description ?? null },
    });
    return mapProject(row);
  }

  async listProjects(): Promise<ProjectRecordWithCount[]> {
    const rows = await this.prisma.project.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { contracts: true } } },
    });
    return rows.map(mapProjectWithCount);
  }

  async getProject(id: string): Promise<ProjectRecordWithCount | null> {
    const row = await this.prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { contracts: true } } },
    });
    return row ? mapProjectWithCount(row) : null;
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<ProjectRecord | null> {
    const data: Prisma.ProjectUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.description !== undefined) {
      data.description = input.description;
    }

    try {
      const row = await this.prisma.project.update({ where: { id }, data });
      return mapProject(row);
    } catch {
      return null;
    }
  }

  async createContract(input: CreateContractInput): Promise<ContractRecord> {
    const row = await this.prisma.contract.create({
      data: { projectId: input.projectId, name: input.name },
    });
    return mapContract(row);
  }

  async listContractsByProject(projectId: string): Promise<ContractRecordWithCount[]> {
    const rows = await this.prisma.contract.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { versions: true } } },
    });
    return rows.map(mapContractWithCount);
  }

  async getContract(id: string): Promise<ContractRecordWithCount | null> {
    const row = await this.prisma.contract.findUnique({
      where: { id },
      include: { _count: { select: { versions: true } } },
    });
    return row ? mapContractWithCount(row) : null;
  }

  async createContractVersion(
    input: CreateContractVersionInput,
  ): Promise<ContractVersionRecord> {
    const row = await this.prisma.contractVersion.create({
      data: {
        contractId: input.contractId,
        label: input.label ?? null,
        format: input.format,
        rawContent: input.rawContent,
        checksum: input.checksum,
        openapiVersion: input.openapiVersion ?? null,
        title: input.title ?? null,
        infoVersion: input.infoVersion ?? null,
        warnings: input.warnings,
      },
    });
    return mapVersion(row);
  }

  async getContractVersion(id: string): Promise<ContractVersionWithContract | null> {
    const row = await this.prisma.contractVersion.findUnique({
      where: { id },
      include: { contract: true },
    });
    return row ? { ...mapVersion(row), contract: mapContract(row.contract) } : null;
  }

  async listVersionsByContract(contractId: string): Promise<ContractVersionRecord[]> {
    const rows = await this.prisma.contractVersion.findMany({
      where: { contractId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapVersion);
  }

  async createAnalysisRun(input: CreateAnalysisRunInput): Promise<AnalysisRunRecord> {
    const row = await this.prisma.analysisRun.create({
      data: {
        projectId: input.projectId,
        baselineVersionId: input.baselineVersionId,
        candidateVersionId: input.candidateVersionId,
        label: input.label ?? null,
        status: "completed",
        truncated: input.truncated,
        totalFindings: input.totalFindings,
        nonBreakingCount: input.nonBreakingCount,
        potentiallyBreakingCount: input.potentiallyBreakingCount,
        unknownCount: input.unknownCount,
        durationMs: input.durationMs,
        limitations: input.limitations,
        baselineSummary: toSummaryJson(input.baselineSummary),
        candidateSummary: toSummaryJson(input.candidateSummary),
        findings: {
          create: input.findings.map((finding, index) => ({
            position: index,
            engineId: finding.engineId,
            category: finding.category,
            changeType: finding.changeType,
            risk: finding.risk,
            path: finding.path ?? null,
            method: finding.method ?? null,
            operationId: finding.operationId ?? null,
            location: finding.location,
            summary: finding.summary,
            explanation: finding.explanation,
            before: finding.before ?? null,
            after: finding.after ?? null,
          })),
        },
      },
    });
    return mapAnalysisRun(row);
  }

  async getAnalysisRun(id: string): Promise<AnalysisRunDetailRecord | null> {
    const row = (await this.prisma.analysisRun.findUnique({
      where: { id },
      include: {
        baselineVersion: { include: { contract: true } },
        candidateVersion: { include: { contract: true } },
        findings: { orderBy: { position: "asc" } },
      },
    })) as AnalysisRowDetail | null;

    if (!row) {
      return null;
    }

    return {
      ...mapAnalysisRun(row),
      baselineVersion: {
        ...mapVersion(row.baselineVersion),
        contract: mapContract(row.baselineVersion.contract),
      },
      candidateVersion: {
        ...mapVersion(row.candidateVersion),
        contract: mapContract(row.candidateVersion.contract),
      },
      findings: row.findings.map(mapFinding),
    };
  }

  async listAnalysisRunsByProject(projectId: string): Promise<AnalysisRunWithVersions[]> {
    const rows = (await this.prisma.analysisRun.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { baselineVersion: true, candidateVersion: true },
    })) as AnalysisRowWithVersions[];

    return rows.map((row) => ({
      ...mapAnalysisRun(row),
      baselineVersion: mapVersion(row.baselineVersion),
      candidateVersion: mapVersion(row.candidateVersion),
    }));
  }
}
