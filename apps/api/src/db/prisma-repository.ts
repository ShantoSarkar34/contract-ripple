import type {
  AnalysisRun as AnalysisRunRow,
  Contract as ContractRow,
  ContractVersion as ContractVersionRow,
  Finding as FindingRow,
  Prisma,
  PrismaClient,
  Project as ProjectRow,
  Session as SessionRow,
  SourceFile as SourceFileRow,
  SourceImpact as SourceImpactRow,
  SourceSnapshot as SourceSnapshotRow,
  User as UserRow,
} from "@prisma/client";
import {
  CHANGE_TYPES,
  FINDING_CATEGORIES,
  RISK_LEVELS,
  SOURCE_CONFIDENCES,
  SOURCE_TYPES,
  type ChangeType,
  type ContractFormat,
  type FindingCategory,
  type RiskLevel,
  type SourceConfidence,
  type SourceType,
} from "@contract-ripple/shared";
import { toContractSummary, toStringArray } from "./json.js";
import type {
  AnalysisRunDetailRecord,
  AnalysisRunPageRecord,
  AnalysisRunRecord,
  AnalysisRunScopeRecord,
  AnalysisRunWithVersions,
  ConsumeRateLimitInput,
  ContractRecord,
  ContractRecordWithCount,
  ContractVersionRecord,
  ContractVersionWithContract,
  CreateAnalysisRunInput,
  CreateContractInput,
  CreateContractVersionInput,
  CreateProjectInput,
  CreateSessionInput,
  CreateSourceSnapshotInput,
  CreateUserInput,
  FindingRecord,
  ListAnalysisRunsPageOptions,
  ProjectRecord,
  ProjectRecordWithCount,
  RateLimitResult,
  Repository,
  SessionRecord,
  SessionWithUserRecord,
  SourceFileRecord,
  SourceImpactRecord,
  SourceSnapshotDetailRecord,
  SourceSnapshotRecord,
  SourceSnapshotWithCount,
  UpdateProjectInput,
  UserRecord,
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
type SourceSnapshotRowWithCount = SourceSnapshotRow & { _count: { impacts: number } };
type SourceSnapshotRowDetail = SourceSnapshotRow & {
  files: SourceFileRow[];
  impacts: SourceImpactRow[];
};
type SessionRowWithUser = SessionRow & { user: UserRow };

function assertOneOf<T extends string>(value: string, allowed: readonly T[], field: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`Stored ${field} value is not recognised.`);
  }
  return value as T;
}

function toFormat(value: string): ContractFormat {
  return value === "json" ? "json" : "yaml";
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
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

function mapSourceFile(row: SourceFileRow): SourceFileRecord {
  return {
    id: row.id,
    snapshotId: row.snapshotId,
    path: row.path,
    bytes: row.bytes,
    skipped: row.skipped,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

function mapSourceImpact(row: SourceImpactRow): SourceImpactRecord {
  return {
    id: row.id,
    snapshotId: row.snapshotId,
    position: row.position,
    filePath: row.filePath,
    line: row.line,
    column: row.column,
    snippet: row.snippet,
    call: row.call,
    method: row.method,
    path: row.path,
    matchedMethod: row.matchedMethod,
    matchedPath: row.matchedPath,
    operationId: row.operationId,
    confidence: assertOneOf(
      row.confidence,
      SOURCE_CONFIDENCES,
      "source confidence",
    ) as SourceConfidence,
    evidence: row.evidence,
    createdAt: row.createdAt,
  };
}

function mapSourceSnapshot(row: SourceSnapshotRow): SourceSnapshotRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    analysisRunId: row.analysisRunId,
    sourceType: assertOneOf(row.sourceType, SOURCE_TYPES, "source type") as SourceType,
    repository: row.repository,
    ref: row.ref,
    fileCount: row.fileCount,
    skippedCount: row.skippedCount,
    totalBytes: row.totalBytes,
    limitations: toStringArray(row.limitations),
    createdAt: row.createdAt,
  };
}

/** Prisma-backed implementation of the API persistence boundary. */
export class PrismaRepository implements Repository {
  constructor(private readonly prisma: PrismaClient) {}

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const row = await this.prisma.user.create({
      data: { email: input.email, passwordHash: input.passwordHash },
    });
    return mapUser(row);
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? mapUser(row) : null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  }

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const row = await this.prisma.session.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
    return mapSession(row);
  }

  async getSessionByTokenHash(tokenHash: string): Promise<SessionWithUserRecord | null> {
    const row = (await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    })) as SessionRowWithUser | null;
    return row ? { ...mapSession(row), user: mapUser(row.user) } : null;
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  async consumeRateLimit(input: ConsumeRateLimitInput): Promise<RateLimitResult> {
    const now = input.now ?? new Date();
    const resetAt = new Date(now.getTime() + input.windowMs);
    const rows = await this.prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
      VALUES (${input.key}, 1, ${resetAt}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
          ELSE "RateLimitBucket"."resetAt"
        END,
        "updatedAt" = ${now}
      RETURNING "count", "resetAt"
    `;
    const row = rows[0];
    if (!row) {
      throw new Error("Rate limit counter could not be updated.");
    }

    return {
      allowed: row.count <= input.limit,
      remaining: Math.max(0, input.limit - row.count),
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000),
      ),
      resetAt: row.resetAt,
    };
  }

  async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const row = await this.prisma.project.create({
      data: {
        ownerId: input.ownerId,
        name: input.name,
        description: input.description ?? null,
      },
    });
    return mapProject(row);
  }

  async listProjects(ownerId: string): Promise<ProjectRecordWithCount[]> {
    const rows = await this.prisma.project.findMany({
      where: { ownerId },
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

  async getAnalysisRunScope(id: string): Promise<AnalysisRunScopeRecord | null> {
    return this.prisma.analysisRun.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });
  }

  async listAnalysisRunsByProject(projectId: string): Promise<AnalysisRunWithVersions[]> {
    const rows = (await this.prisma.analysisRun.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { baselineVersion: true, candidateVersion: true },
    })) as AnalysisRowWithVersions[];

    return rows.map((row) => ({
      ...mapAnalysisRun(row),
      baselineVersion: mapVersion(row.baselineVersion),
      candidateVersion: mapVersion(row.candidateVersion),
    }));
  }

  async listAnalysisRunsByProjectPage(
    projectId: string,
    options: ListAnalysisRunsPageOptions,
  ): Promise<AnalysisRunPageRecord> {
    const [totalCount, rawRows] = await Promise.all([
      this.prisma.analysisRun.count({ where: { projectId } }),
      this.prisma.analysisRun.findMany({
        where: { projectId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: options.limit + 1,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
        include: { baselineVersion: true, candidateVersion: true },
      }),
    ]);
    const rows = rawRows as AnalysisRowWithVersions[];

    const hasMore = rows.length > options.limit;
    const page = hasMore ? rows.slice(0, options.limit) : rows;
    const last = page[page.length - 1];

    return {
      runs: page.map((row) => ({
        ...mapAnalysisRun(row),
        baselineVersion: mapVersion(row.baselineVersion),
        candidateVersion: mapVersion(row.candidateVersion),
      })),
      totalCount,
      nextCursor: hasMore && last ? last.id : null,
    };
  }

  async createSourceSnapshot(input: CreateSourceSnapshotInput): Promise<SourceSnapshotRecord> {
    const row = await this.prisma.sourceSnapshot.create({
      data: {
        projectId: input.projectId,
        analysisRunId: input.analysisRunId ?? null,
        sourceType: input.sourceType,
        repository: input.repository ?? null,
        ref: input.ref ?? null,
        fileCount: input.fileCount,
        skippedCount: input.skippedCount,
        totalBytes: input.totalBytes,
        limitations: input.limitations,
        files: {
          create: input.files.map((file) => ({
            path: file.path,
            bytes: file.bytes,
            skipped: file.skipped,
            reason: file.reason ?? null,
          })),
        },
        impacts: {
          create: input.impacts.map((impact, position) => ({
            position,
            filePath: impact.filePath,
            line: impact.line,
            column: impact.column,
            snippet: impact.snippet,
            call: impact.call,
            method: impact.method,
            path: impact.path,
            matchedMethod: impact.matchedMethod,
            matchedPath: impact.matchedPath,
            operationId: impact.operationId ?? null,
            confidence: impact.confidence,
            evidence: impact.evidence,
          })),
        },
      },
    });
    return mapSourceSnapshot(row);
  }

  async getSourceSnapshot(id: string): Promise<SourceSnapshotDetailRecord | null> {
    const row = (await this.prisma.sourceSnapshot.findUnique({
      where: { id },
      include: {
        files: { orderBy: { path: "asc" } },
        impacts: { orderBy: { position: "asc" } },
      },
    })) as SourceSnapshotRowDetail | null;

    if (!row) {
      return null;
    }

    return {
      ...mapSourceSnapshot(row),
      files: row.files.map(mapSourceFile),
      impacts: row.impacts.map(mapSourceImpact),
    };
  }

  async listSourceSnapshotsByProject(projectId: string): Promise<SourceSnapshotWithCount[]> {
    const rows = (await this.prisma.sourceSnapshot.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { _count: { select: { impacts: true } } },
    })) as SourceSnapshotRowWithCount[];

    return rows.map((row) => ({
      ...mapSourceSnapshot(row),
      impactCount: row._count.impacts,
    }));
  }

  async listSourceSnapshotsByAnalysisRun(
    analysisRunId: string,
  ): Promise<SourceSnapshotWithCount[]> {
    const rows = (await this.prisma.sourceSnapshot.findMany({
      where: { analysisRunId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { _count: { select: { impacts: true } } },
    })) as SourceSnapshotRowWithCount[];

    return rows.map((row) => ({
      ...mapSourceSnapshot(row),
      impactCount: row._count.impacts,
    }));
  }
}
