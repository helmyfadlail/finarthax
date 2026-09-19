import { AsyncLocalStorage } from "node:async_hooks";

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

export const setRequestUser = (userId: string): void => {
  const store = storage.getStore();
  if (store) store.userId = userId;
};
