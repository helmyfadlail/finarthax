import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request data that every log line emitted while handling that request is
 * automatically stamped with. Filling this in once - at the edge of the request -
 * is what makes a single `requestId` enough to reconstruct everything that
 * happened for one call in production.
 */
export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  route: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  startedAt: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(context: RequestContext, callback: () => Promise<T>): Promise<T> => storage.run(context, callback);

export const getRequestContext = (): RequestContext | undefined => storage.getStore();

export const getRequestId = (): string | undefined => storage.getStore()?.requestId;

/**
 * Called once authentication resolves, so log lines written *before* auth stay
 * anonymous while everything after them carries the user id.
 */
export const setRequestUser = (userId: string): void => {
  const store = storage.getStore();
  if (store) store.userId = userId;
};
