import type {
  AuthSessionResponse,
  LoginRequest,
  RegisterRequest,
} from "@contract-ripple/shared";
import type { Repository, UserRecord } from "../db/types.js";
import { HttpError } from "../middleware/http-error.js";
import { hashPassword, spendDummyPasswordCheck, verifyPassword } from "./password.js";
import {
  createSession,
  hashSessionToken,
  toAuthSessionResponse,
  type NewAuthSession,
} from "./session.js";

export type AuthResult = {
  response: AuthSessionResponse;
  token: string;
  expiresAt: Date;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailTaken(): HttpError {
  return new HttpError(409, "email_taken", "An account with this email already exists.");
}

function invalidCredentials(): HttpError {
  return new HttpError(401, "invalid_credentials", "Email or password is incorrect.");
}

function toAuthResult(session: NewAuthSession): AuthResult {
  return {
    response: toAuthSessionResponse(session.user, session.csrfToken, session.expiresAt),
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

export async function registerUser(
  repository: Repository,
  input: RegisterRequest,
  authSecret: string,
): Promise<AuthResult> {
  const email = normalizeEmail(input.email);

  if (await repository.getUserByEmail(email)) {
    throw emailTaken();
  }

  const passwordHash = await hashPassword(input.password);

  let user: UserRecord;
  try {
    user = await repository.createUser({ email, passwordHash });
  } catch (error) {
    // The unique index is the final guard against two simultaneous sign-ups.
    if (await repository.getUserByEmail(email)) {
      throw emailTaken();
    }
    throw error;
  }

  return toAuthResult(await createSession(repository, user, authSecret));
}

export async function loginUser(
  repository: Repository,
  input: LoginRequest,
  authSecret: string,
): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const user = await repository.getUserByEmail(email);

  if (!user) {
    await spendDummyPasswordCheck(input.password);
    throw invalidCredentials();
  }

  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw invalidCredentials();
  }

  return toAuthResult(await createSession(repository, user, authSecret));
}

export async function signOut(
  repository: Repository,
  token: string | undefined,
): Promise<void> {
  if (!token) {
    return;
  }
  await repository.deleteSessionByTokenHash(hashSessionToken(token));
}
