import type { RiskLevel } from "./types.js";

export type Direction = "request" | "response";

export type Classification = {
  risk: RiskLevel;
  explanation: string;
};

/**
 * Risk classification is intentionally separate from diff traversal so the
 * rules can be reviewed, tested, and adjusted without changing comparison code.
 *
 * Rules are conservative: when a change can plausibly break an existing client
 * and the engine cannot prove otherwise, it is `potentially_breaking` or
 * `unknown`, never silently treated as safe.
 */

export function classifyAddedOperation(): Classification {
  return {
    risk: "non_breaking",
    explanation:
      "The operation is additive. Existing clients are not required to call it.",
  };
}

export function classifyRemovedOperation(): Classification {
  return {
    risk: "potentially_breaking",
    explanation:
      "Clients that call this operation will fail or receive an error response.",
  };
}

export function classifyAddedParameter(required: boolean): Classification {
  return required
    ? {
        risk: "potentially_breaking",
        explanation:
          "The parameter is required. Existing requests that omit it will fail validation.",
      }
    : {
        risk: "non_breaking",
        explanation:
          "The parameter is optional, so existing requests remain valid.",
      };
}

export function classifyRemovedParameter(): Classification {
  return {
    risk: "potentially_breaking",
    explanation:
      "Existing clients may still send the parameter; the server may reject it or behave differently.",
  };
}

export function classifyParameterRequiredChange(
  becameRequired: boolean,
): Classification {
  return becameRequired
    ? {
        risk: "potentially_breaking",
        explanation:
          "Requests that omitted the parameter were valid before and are now invalid.",
      }
    : {
        risk: "non_breaking",
        explanation:
          "Existing requests remain valid; the parameter is now optional.",
      };
}

export function classifyAddedRequestBody(required: boolean): Classification {
  return required
    ? {
        risk: "potentially_breaking",
        explanation:
          "The new request body is required. Existing requests without a body will fail validation.",
      }
    : {
        risk: "non_breaking",
        explanation:
          "The new request body is optional, so existing requests remain valid.",
      };
}

export function classifyRemovedRequestBody(): Classification {
  return {
    risk: "potentially_breaking",
    explanation:
      "Clients that send a request body may be rejected or their body may be ignored.",
  };
}

export function classifyRequestBodyRequiredChange(
  becameRequired: boolean,
): Classification {
  return becameRequired
    ? {
        risk: "potentially_breaking",
        explanation:
          "Requests without a body were valid before and now fail validation.",
      }
    : {
        risk: "non_breaking",
        explanation:
          "Requests remain valid; the body is now optional.",
      };
}

export function classifyAddedResponse(): Classification {
  return {
    risk: "non_breaking",
    explanation:
      "New response status codes are additive. Existing success paths remain available.",
  };
}

export function classifyRemovedResponse(): Classification {
  return {
    risk: "potentially_breaking",
    explanation:
      "Clients that depend on this response status will no longer receive it.",
  };
}

export function classifyAddedMediaType(direction: Direction): Classification {
  return direction === "request"
    ? {
        risk: "non_breaking",
        explanation:
          "The server accepts an additional request media type; existing requests remain valid.",
      }
    : {
        risk: "non_breaking",
        explanation:
          "The server may return an additional response media type; existing content negotiation remains supported.",
      };
}

export function classifyRemovedMediaType(direction: Direction): Classification {
  return direction === "request"
    ? {
        risk: "potentially_breaking",
        explanation:
          "Clients that send the removed request media type may now be rejected.",
      }
    : {
        risk: "potentially_breaking",
        explanation:
          "Clients that request the removed response media type may no longer receive it.",
      };
}

export function classifyOperationIdChange(): Classification {
  return {
    risk: "potentially_breaking",
    explanation:
      "Generated clients may rename methods or types, causing compile-time breakage.",
  };
}

export function classifyAddedProperty(
  direction: Direction,
  required: boolean,
): Classification {
  if (direction === "request") {
    return required
      ? {
          risk: "potentially_breaking",
          explanation:
            "The property is required. Existing payloads that omit it are now invalid.",
        }
      : {
          risk: "non_breaking",
          explanation:
            "The property is optional, so existing payloads remain valid.",
        };
  }

  return {
    risk: "non_breaking",
    explanation:
      "Extra response properties are additive; clients that ignore unknown fields are unaffected.",
  };
}

export function classifyRemovedProperty(direction: Direction): Classification {
  return direction === "request"
    ? {
        risk: "potentially_breaking",
        explanation:
          "Clients may still send the removed property; the server may reject or ignore it.",
      }
    : {
        risk: "potentially_breaking",
        explanation:
          "Clients that read this response property will receive no value.",
      };
}

export function classifyRequiredPropertyChange(
  direction: Direction,
  becameRequired: boolean,
): Classification {
  if (direction === "request") {
    return becameRequired
      ? {
          risk: "potentially_breaking",
          explanation:
            "Payloads that omitted this property were valid before and are now invalid.",
        }
      : {
          risk: "non_breaking",
          explanation:
            "Payloads remain valid; the property is now optional.",
        };
  }

  return becameRequired
    ? {
        risk: "non_breaking",
        explanation:
          "The server now guarantees the response property is present; clients are not required to change.",
      }
    : {
        risk: "potentially_breaking",
        explanation:
          "Clients that assumed the response property was always present may now receive no value.",
      };
}

export function classifyTypeChange(
  direction: Direction,
  addedTypes: string[],
  removedTypes: string[],
): Classification {
  if (addedTypes.length > 0 && removedTypes.length === 0) {
    return direction === "request"
      ? {
          risk: "non_breaking",
          explanation:
            "The candidate accepts additional value types; existing values remain valid.",
        }
      : {
          risk: "potentially_breaking",
          explanation:
            "The server may now return an additional value type that clients do not handle.",
        };
  }

  if (removedTypes.length > 0 && addedTypes.length === 0) {
    return direction === "request"
      ? {
          risk: "potentially_breaking",
          explanation:
            "The candidate no longer accepts value types that were valid before.",
        }
      : {
          risk: "non_breaking",
          explanation:
            "The server returns a narrower set of value types; existing clients remain compatible.",
        };
  }

  return {
    risk: "potentially_breaking",
    explanation:
      "The set of allowed value types changed; values that matched the baseline may no longer match.",
  };
}

export function classifyUntypedChange(): Classification {
  return {
    risk: "unknown",
    explanation:
      "One side does not declare a type, so the compatibility impact cannot be determined safely.",
  };
}

export function classifyFormatChange(): Classification {
  return {
    risk: "potentially_breaking",
    explanation:
      "The serialization or validation semantics for the same type may have changed.",
  };
}

export function classifyEnumValueAdded(direction: Direction): Classification {
  return direction === "request"
    ? {
        risk: "non_breaking",
        explanation:
          "The server accepts an additional enum value; existing values remain valid.",
      }
    : {
        risk: "potentially_breaking",
        explanation:
          "The server may return an enum value that clients do not recognize.",
      };
}

export function classifyEnumValueRemoved(direction: Direction): Classification {
  return direction === "request"
    ? {
        risk: "potentially_breaking",
        explanation:
          "Clients that send this enum value may now be rejected.",
      }
    : {
        risk: "non_breaking",
        explanation:
          "The server will no longer return this enum value; clients that handled it remain compatible.",
      };
}

export function classifyEnumConstraintAdded(direction: Direction): Classification {
  return direction === "request"
    ? {
        risk: "potentially_breaking",
        explanation:
          "The candidate adds an enum constraint; values accepted before may now be rejected.",
      }
    : {
        risk: "unknown",
        explanation:
          "The candidate adds an enum constraint to a response; the client impact depends on how strictly clients validate responses.",
      };
}

export function classifyEnumConstraintRemoved(direction: Direction): Classification {
  return direction === "request"
    ? {
        risk: "non_breaking",
        explanation:
          "The enum constraint was removed; the server accepts a wider set of values.",
      }
    : {
        risk: "potentially_breaking",
        explanation:
          "The server may now return values outside the previous enum.",
      };
}

export function classifyConstraintChange(direction: Direction): Classification {
  return direction === "request"
    ? {
        risk: "potentially_breaking",
        explanation:
          "Validation constraints changed; payloads that were valid under the baseline may be rejected.",
      }
    : {
        risk: "unknown",
        explanation:
          "Response validation constraints changed; the client impact depends on how the client consumes and validates responses.",
      };
}

export function classifyObjectSchemaChange(): Classification {
  return {
    risk: "potentially_breaking",
    explanation:
      "The schema switched between a boolean schema and a structured schema, changing what values are accepted.",
  };
}

export function classifyReferenceChange(): Classification {
  return {
    risk: "potentially_breaking",
    explanation:
      "The schema reference changed. Generated clients may rename referenced types even when the resolved shape is similar.",
  };
}

export function classifyUnresolvedReferenceChange(): Classification {
  return {
    risk: "unknown",
    explanation:
      "A schema reference could not be resolved safely, so the compatibility impact is unknown.",
  };
}

export function classifyCombinatorChange(keyword: string): Classification {
  return {
    risk: "unknown",
    explanation: `The \`${keyword}\` composition changed. This phase does not fully interpret composition semantics, so the compatibility impact is unknown.`,
  };
}

export function classifyUnsupportedKeywordChange(keyword: string): Classification {
  return {
    risk: "unknown",
    explanation: `The \`${keyword}\` keyword is not fully interpreted by this phase, so the compatibility impact is unknown.`,
  };
}

export function classifySerializationChange(): Classification {
  return {
    risk: "unknown",
    explanation:
      "Parameter serialization metadata changed; the client impact depends on how requests are encoded.",
  };
}

export function classifyArrayItemsChange(): Classification {
  return {
    risk: "unknown",
    explanation:
      "The array item schema was added or removed, so the compatibility impact cannot be determined safely.",
  };
}

export function classifySchemaPresenceChange(): Classification {
  return {
    risk: "unknown",
    explanation:
      "The schema was added or removed, so the compatibility impact cannot be determined safely.",
  };
}
