// CloudFront Function: viewer-request path rewrite for Etendo MCP / OAuth2.
//
// The SPA advertises clean, root-level URLs in its .well-known discovery docs
// (served by S3):
//   resource:              https://<host>/mcp
//   authorization_endpoint: https://<host>/authorize   (React Router, SPA route)
//   token_endpoint:         https://<host>/oauth2/token
//   registration_endpoint:  https://<host>/oauth2/register
//
// The backend (Etendo + NEO Headless) exposes them under the Tomcat context
// path `/etendo`:
//   /etendo/sws/mcp
//   /etendo/oauth2/*
//
// This function runs at viewer-request on the CloudFront behaviors attached to
// `/mcp` and `/oauth2/*`, rewriting the URI before it reaches the ALB origin so
// MCP clients and OAuth2 clients can use the short, context-agnostic URLs.
// `/authorize` is not rewritten here — it is an SPA route served by S3 fallback
// and handled by React Router client-side.
//
// Deploy with `aws cloudfront create-function` / `update-function`.

function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // /mcp  or  /mcp/anything  → /etendo/sws/mcp(/anything)
  if (uri === '/mcp' || uri.indexOf('/mcp/') === 0) {
    request.uri = '/etendo/sws' + uri;
    return request;
  }

  // /oauth2/*  → /etendo/oauth2/*
  if (uri.indexOf('/oauth2/') === 0) {
    request.uri = '/etendo' + uri;
    return request;
  }

  return request;
}
