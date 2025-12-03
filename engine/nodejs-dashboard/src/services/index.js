/**
 * Service Barrel
 *
 * Centralized export point for HTTP client and domain services.
 * Consumers can import from "services" instead of referencing individual paths.
 *
 * Exposed Modules:
 * - httpClient: preconfigured HTTP layer (axios-like).
 * - healthService, httpRequestsService, analyzerService, techstackService,
 *   sparqlService, pcapService, socketService: feature-oriented APIs.
 */

export { default as httpClient } from './httpClient';

export * as healthService from './healthService';
export * as httpRequestsService from './httpRequestsService';
export * as analyzerService from './analyzerService';
export * as techstackService from './techstackService';
export * as sparqlService from './sparqlService';
export * as pcapService from './pcapService';
export * as socketService from './socketService';
