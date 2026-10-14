// Builds request headers from env vars. The value is NEVER logged.
//   SESSION_COOKIE   full cookie header value (preferred)
//   BEARER_TOKEN     alternative bearer token
export function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (__ENV.SESSION_COOKIE) headers['Cookie'] = __ENV.SESSION_COOKIE;
  else if (__ENV.BEARER_TOKEN) headers['Authorization'] = 'Bearer ' + __ENV.BEARER_TOKEN;
  return headers;
}

export function hasAuth() {
  return !!(__ENV.SESSION_COOKIE || __ENV.BEARER_TOKEN);
}
