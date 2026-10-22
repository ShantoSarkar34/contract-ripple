import { ApiRequestError, describeErrorDetails } from "@/lib/api";

export type RequestFailure = {
  message: string;
  details: string[];
  notFound: boolean;
  unauthorized: boolean;
};

/**
 * Normalizes the API's error envelope for page-level loading states. Only
 * validation errors expose field details; other errors keep their message.
 */
export function describeRequestFailure(
  error: unknown,
  fallback: string,
): RequestFailure {
  if (error instanceof ApiRequestError) {
    return {
      message: error.message,
      details: describeErrorDetails(error),
      notFound: error.status === 404,
      unauthorized: error.status === 401,
    };
  }

  return {
    message: error instanceof Error ? error.message : fallback,
    details: [],
    notFound: false,
    unauthorized: false,
  };
}
