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

function clone<T>(value: T): T {
  return structuredClone(value);
}

type RateLimitBucketRecord = {
  count: number;
  resetAt: Date;
};

function compareAnalysisRunsDesc(
  left: AnalysisRunRecord,
  right: AnalysisRunRecord,
): number {
  return (
    right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id)
  );
}

function compareSourceSnapshotsDesc(
  left: SourceSnapshotRecord,
  right: SourceSnapshotRecord,
): number {
  return (
    right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id)
  );
}

/**
 * In-memory repository used by unit and route tests. It mirrors the behaviour
 * the Prisma implementation relies on (cascade delete is simulated for
 * `deleteProject`, which the tests use for cleanup).
 */
export class MemoryRepository implements Repository {
  private counter = 0;
  private readonly users = new Map<string, UserRecord>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly rateLimits = new Map<string, RateLimitBucketRecord>();
  private readonly projects = new Map<string, ProjectRecord>();
  private readonly contracts = new Map<string, ContractRecord>();
  private readonly versions = new Map<string, ContractVersionRecord>();
  private readonly analysisRuns = new Map<string, AnalysisRunRecord>();
  private readonly findings = new Map<string, FindingRecord>();
  private readonly sourceSnapshots = new Map<string, SourceSnapshotRecord>();
  private readonly sourceFiles = new Map<string, SourceFileRecord>();
  private readonly sourceImpacts = new Map<string, SourceImpactRecord>();

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_${this.counter}`;
  }

  async ping(): Promise<void> {
    return Promise.resolve();
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const now = new Date();
    const record: UserRecord = {
      id: this.nextId("user"),
      email: input.email,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(record.id, record);
    return clone(record);
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const user = [...this.users.values()].find((entry) => entry.email === email);
    return user ? clone(user) : null;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? clone(user) : null;
  }

  async createSession(input: CreateSessionInput): Promise<SessionRecord> {
    const record: SessionRecord = {
      id: this.nextId("session"),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
    };
    this.sessions.set(record.id, record);
    return clone(record);
  }

  async getSessionByTokenHash(tokenHash: string): Promise<SessionWithUserRecord | null> {
    const session = [...this.sessions.values()].find(
      (entry) => entry.tokenHash === tokenHash,
    );
    if (!session) {
      return null;
    }
    const user = this.users.get(session.userId);
    if (!user) {
      return null;
    }
    return { ...clone(session), user: clone(user) };
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    for (const [id, session] of this.sessions) {
      if (session.tokenHash === tokenHash) {
        this.sessions.delete(id);
      }
    }
  }

  async consumeRateLimit(input: ConsumeRateLimitInput): Promise<RateLimitResult> {
    const now = input.now ?? new Date();
    const current = this.rateLimits.get(input.key);
    const resetAt = new Date(now.getTime() + input.windowMs);
    const bucket =
      !current || current.resetAt.getTime() <= now.getTime()
        ? { count: 1, resetAt }
        : { count: current.count + 1, resetAt: current.resetAt };
    this.rateLimits.set(input.key, bucket);

    return {
      allowed: bucket.count <= input.limit,
      remaining: Math.max(0, input.limit - bucket.count),
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000),
      ),
      resetAt: new Date(bucket.resetAt),
    };
  }

  async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const now = new Date();
    const record: ProjectRecord = {
      id: this.nextId("proj"),
      ownerId: input.ownerId,
      name: input.name,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(record.id, record);
    return clone(record);
  }

  async listProjects(ownerId: string): Promise<ProjectRecordWithCount[]> {
    return [...this.projects.values()]
      .filter((project) => project.ownerId === ownerId)
      .map((project) => ({
        ...clone(project),
        contractCount: [...this.contracts.values()].filter(
          (contract) => contract.projectId === project.id,
        ).length,
      }));
  }

  async getProject(id: string): Promise<ProjectRecordWithCount | null> {
    const project = this.projects.get(id);
    if (!project) {
      return null;
    }
    return {
      ...clone(project),
      contractCount: [...this.contracts.values()].filter(
        (contract) => contract.projectId === id,
      ).length,
    };
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<ProjectRecord | null> {
    const project = this.projects.get(id);
    if (!project) {
      return null;
    }
    const updated: ProjectRecord = {
      ...project,
      name: input.name ?? project.name,
      description: input.description === undefined ? project.description : input.description,
      updatedAt: new Date(),
    };
    this.projects.set(id, updated);
    return clone(updated);
  }

  async createContract(input: CreateContractInput): Promise<ContractRecord> {
    const now = new Date();
    const record: ContractRecord = {
      id: this.nextId("contract"),
      projectId: input.projectId,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    };
    this.contracts.set(record.id, record);
    return clone(record);
  }

  async listContractsByProject(projectId: string): Promise<ContractRecordWithCount[]> {
    return [...this.contracts.values()]
      .filter((contract) => contract.projectId === projectId)
      .map((contract) => ({
        ...clone(contract),
        versionCount: [...this.versions.values()].filter(
          (version) => version.contractId === contract.id,
        ).length,
      }));
  }

  async getContract(id: string): Promise<ContractRecordWithCount | null> {
    const contract = this.contracts.get(id);
    if (!contract) {
      return null;
    }
    return {
      ...clone(contract),
      versionCount: [...this.versions.values()].filter(
        (version) => version.contractId === id,
      ).length,
    };
  }

  async createContractVersion(
    input: CreateContractVersionInput,
  ): Promise<ContractVersionRecord> {
    const record: ContractVersionRecord = {
      id: this.nextId("version"),
      contractId: input.contractId,
      label: input.label ?? null,
      format: input.format,
      rawContent: input.rawContent,
      checksum: input.checksum,
      openapiVersion: input.openapiVersion ?? null,
      title: input.title ?? null,
      infoVersion: input.infoVersion ?? null,
      warnings: [...input.warnings],
      createdAt: new Date(),
    };
    this.versions.set(record.id, record);
    return clone(record);
  }

  async getContractVersion(id: string): Promise<ContractVersionWithContract | null> {
    const version = this.versions.get(id);
    if (!version) {
      return null;
    }
    const contract = this.contracts.get(version.contractId);
    if (!contract) {
      return null;
    }
    return { ...clone(version), contract: clone(contract) };
  }

  async listVersionsByContract(contractId: string): Promise<ContractVersionRecord[]> {
    return [...this.versions.values()]
      .filter((version) => version.contractId === contractId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(clone);
  }

  async createAnalysisRun(input: CreateAnalysisRunInput): Promise<AnalysisRunRecord> {
    const record: AnalysisRunRecord = {
      id: this.nextId("run"),
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
      limitations: [...input.limitations],
      baselineSummary: clone(input.baselineSummary),
      candidateSummary: clone(input.candidateSummary),
      createdAt: new Date(),
    };
    this.analysisRuns.set(record.id, record);

    input.findings.forEach((finding, position) => {
      const id = this.nextId("finding");
      this.findings.set(id, {
        id,
        analysisRunId: record.id,
        position,
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
        createdAt: new Date(),
      });
    });

    return clone(record);
  }

  async getAnalysisRun(id: string): Promise<AnalysisRunDetailRecord | null> {
    const run = this.analysisRuns.get(id);
    if (!run) {
      return null;
    }
    const baselineVersion = this.versions.get(run.baselineVersionId);
    const candidateVersion = this.versions.get(run.candidateVersionId);
    const baselineContract = baselineVersion
      ? this.contracts.get(baselineVersion.contractId)
      : undefined;
    const candidateContract = candidateVersion
      ? this.contracts.get(candidateVersion.contractId)
      : undefined;
    if (!baselineVersion || !candidateVersion || !baselineContract || !candidateContract) {
      return null;
    }
    return {
      ...clone(run),
      baselineVersion: { ...clone(baselineVersion), contract: clone(baselineContract) },
      candidateVersion: { ...clone(candidateVersion), contract: clone(candidateContract) },
      findings: [...this.findings.values()]
        .filter((finding) => finding.analysisRunId === id)
        .sort((left, right) => left.position - right.position)
        .map(clone),
    };
  }

  async getAnalysisRunScope(id: string): Promise<AnalysisRunScopeRecord | null> {
    const run = this.analysisRuns.get(id);
    return run ? { id: run.id, projectId: run.projectId } : null;
  }

  async listAnalysisRunsByProject(projectId: string): Promise<AnalysisRunWithVersions[]> {
    return [...this.analysisRuns.values()]
      .filter((run) => run.projectId === projectId)
      .sort(compareAnalysisRunsDesc)
      .map((run) => {
        const baselineVersion = this.versions.get(run.baselineVersionId);
        const candidateVersion = this.versions.get(run.candidateVersionId);
        if (!baselineVersion || !candidateVersion) {
          throw new Error("Analysis run references a missing contract version.");
        }
        return {
          ...clone(run),
          baselineVersion: clone(baselineVersion),
          candidateVersion: clone(candidateVersion),
        };
      });
  }

  async listAnalysisRunsByProjectPage(
    projectId: string,
    options: ListAnalysisRunsPageOptions,
  ): Promise<AnalysisRunPageRecord> {
    const runs = await this.listAnalysisRunsByProject(projectId);
    const totalCount = runs.length;

    let start = 0;
    if (options.cursor) {
      const cursorIndex = runs.findIndex((run) => run.id === options.cursor);
      if (cursorIndex < 0) {
        return { runs: [], totalCount, nextCursor: null };
      }
      start = cursorIndex + 1;
    }

    const candidates = runs.slice(start, start + options.limit + 1);
    const hasMore = candidates.length > options.limit;
    const page = hasMore ? candidates.slice(0, options.limit) : candidates;
    const last = page[page.length - 1];

    return {
      runs: page,
      totalCount,
      nextCursor: hasMore && last ? last.id : null,
    };
  }

  async createSourceSnapshot(input: CreateSourceSnapshotInput): Promise<SourceSnapshotRecord> {
    const record: SourceSnapshotRecord = {
      id: this.nextId("source"),
      projectId: input.projectId,
      analysisRunId: input.analysisRunId ?? null,
      sourceType: input.sourceType,
      repository: input.repository ?? null,
      ref: input.ref ?? null,
      fileCount: input.fileCount,
      skippedCount: input.skippedCount,
      totalBytes: input.totalBytes,
      limitations: [...input.limitations],
      createdAt: new Date(),
    };
    this.sourceSnapshots.set(record.id, record);

    for (const file of input.files) {
      const id = this.nextId("sourcefile");
      this.sourceFiles.set(id, {
        id,
        snapshotId: record.id,
        path: file.path,
        bytes: file.bytes,
        skipped: file.skipped,
        reason: file.reason ?? null,
        createdAt: new Date(),
      });
    }

    input.impacts.forEach((impact, position) => {
      const id = this.nextId("impact");
      this.sourceImpacts.set(id, {
        id,
        snapshotId: record.id,
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
        createdAt: new Date(),
      });
    });

    return clone(record);
  }

  async getSourceSnapshot(id: string): Promise<SourceSnapshotDetailRecord | null> {
    const snapshot = this.sourceSnapshots.get(id);
    if (!snapshot) {
      return null;
    }
    return {
      ...clone(snapshot),
      files: [...this.sourceFiles.values()]
        .filter((file) => file.snapshotId === id)
        .map(clone),
      impacts: [...this.sourceImpacts.values()]
        .filter((impact) => impact.snapshotId === id)
        .sort((left, right) => left.position - right.position)
        .map(clone),
    };
  }

  async listSourceSnapshotsByProject(projectId: string): Promise<SourceSnapshotWithCount[]> {
    return [...this.sourceSnapshots.values()]
      .filter((snapshot) => snapshot.projectId === projectId)
      .sort(compareSourceSnapshotsDesc)
      .map((snapshot) => ({
        ...clone(snapshot),
        impactCount: [...this.sourceImpacts.values()].filter(
          (impact) => impact.snapshotId === snapshot.id,
        ).length,
      }));
  }

  async listSourceSnapshotsByAnalysisRun(
    analysisRunId: string,
  ): Promise<SourceSnapshotWithCount[]> {
    return [...this.sourceSnapshots.values()]
      .filter((snapshot) => snapshot.analysisRunId === analysisRunId)
      .sort(compareSourceSnapshotsDesc)
      .map((snapshot) => ({
        ...clone(snapshot),
        impactCount: [...this.sourceImpacts.values()].filter(
          (impact) => impact.snapshotId === snapshot.id,
        ).length,
      }));
  }
}
