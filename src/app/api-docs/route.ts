import { NextResponse } from "next/server";

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Finarthax API</title>
    <link rel="icon" href="/finarthax.png" />
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafafa; }
      .topbar { display: none; }
      .swagger-ui .info { margin: 24px 0; }
    </style>
  </head>
  <body>
    <div id="swagger"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: "/openapi.json",
          dom_id: "#swagger",
          deepLinking: true,
          displayRequestDuration: true,
          docExpansion: "none",
          filter: true,
          persistAuthorization: true,
          tryItOutEnabled: true,
          requestInterceptor: (request) => {
            // Send the NextAuth session cookie so protected routes can be tried from here.
            request.credentials = "include";
            return request;
          },
        });
      };
    </script>
  </body>
</html>`;

export async function GET() {
  return new NextResponse(PAGE, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
