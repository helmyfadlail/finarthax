import type { Instrumentation } from "next";

/**
 * Runs once when the server boots. The Node-only work lives behind a dynamic
 * import so the edge bundle never pulls in `process.on` or `node:async_hooks`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { registerNodeInstrumentation } = await import("./instrumentation-node");
  registerNodeInstrumentation();
}

/**
 * Next calls this for every server-side error it catches itself - server
 * components, page renders, and anything that fails outside our own `withApi`
 * wrapper. Without it those errors only ever reach stdout unstructured.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { logger } = await import("./lib/logger");

  logger.error("server.request_error", {
    err: error,
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
