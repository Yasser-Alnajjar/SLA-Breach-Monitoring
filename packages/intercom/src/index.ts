export {
  deriveNormalizedEventsForConversation,
  deriveCaseClosedAt,
  normalizeIntercomState,
  resolveIntercomActor,
  runIntercomNormalization,
  sortPartsChronologically,
  UnknownIntercomStateError,
} from "./normalize";
export type {
  ConversationPartRecord,
  DerivedNormalizedEvent,
  NormalizationResult,
} from "./normalize";
export {
  mapCompanyToRawEvent,
  mapContactToRawEvent,
  mapConversationPartToRawEvent,
  mapConversationToRawEvent,
} from "./rawEvents";
export type { RawEventInput } from "./rawEvents";
export * from "./types";
export { IntercomClient, IntercomApiError } from "./client";
export type { IntercomClientOptions } from "./client";
export { computeSourceHash } from "./hash";
export { runIntercomBackfill } from "./backfill";
export type { BackfillResult } from "./backfill";
export type { IntercomOAuthConfig } from "./oauth";
export { buildAuthorizeUrl, exchangeCodeForToken, IntercomOAuthError } from "./oauth";
export {
  loadFreshIntercomCredentials,
  markReauthRequired,
  IntercomReauthRequiredError,
} from "./tokenLifecycle";
