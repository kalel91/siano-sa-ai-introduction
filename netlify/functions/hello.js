// CommonJS per evitare qualsiasi ambiguità ESM/CJS
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      now: new Date().toISOString(),
      path: event.rawUrl || event.path
    })
  };
};
