/**
 * OpenBare Edge - Bare Protocol v3 Implementation
 * TompHTTP Bare Server Protocol
 */

/**
 * Parse Bare headers from request
 */
function parseBareHeaders(request) {
  const headers = request.headers;
  
  // Required headers
  const bareUrl = headers.get('x-bare-url');
  const bareHeadersRaw = headers.get('x-bare-headers');
  
  // Optional headers
  const bareForwardHeaders = headers.get('x-bare-forward-headers');
  const barePassHeaders = headers.get('x-bare-pass-headers');
  const barePassStatus = headers.get('x-bare-pass-status');
  const bareProtocol = headers.get('x-bare-protocol');
  const bareHost = headers.get('x-bare-host');
  const barePort = headers.get('x-bare-port');
  const barePath = headers.get('x-bare-path');
  
  // Parse JSON headers
  let bareHeaders = {};
  if (bareHeadersRaw) {
    try {
      bareHeaders = JSON.parse(bareHeadersRaw);
    } catch (_e) {
      throw new BareError(400, 'INVALID_BARE_HEADERS', 'x-bare-headers is not valid JSON');
    }
  }

  // Parse forward headers array
  let forwardHeaders = [];
  if (bareForwardHeaders) {
    try {
      forwardHeaders = JSON.parse(bareForwardHeaders);
    } catch (_e) {
      forwardHeaders = bareForwardHeaders.split(',').map(h => h.trim());
    }
  }

  // Parse pass headers array
  let passHeaders = [];
  if (barePassHeaders) {
    try {
      passHeaders = JSON.parse(barePassHeaders);
    } catch (_e) {
      passHeaders = barePassHeaders.split(',').map(h => h.trim());
    }
  }

  // Parse pass status array
  let passStatus = [];
  if (barePassStatus) {
    try {
      passStatus = JSON.parse(barePassStatus);
    } catch (_e) {
      passStatus = barePassStatus.split(',').map(s => parseInt(s.trim(), 10));
    }
  }

  return {
    url: bareUrl,
    headers: bareHeaders,
    forwardHeaders,
    passHeaders,
    passStatus,
    protocol: bareProtocol,
    host: bareHost,
    port: barePort,
    path: barePath
  };
}

/**
 * Build target URL from bare headers
 */
function buildTargetUrl(bareData) {
  // Direct URL provided
  if (bareData.url) {
    try {
      return new URL(bareData.url);
    } catch (_e) {
      throw new BareError(400, 'INVALID_BARE_URL', 'x-bare-url is not a valid URL');
    }
  }

  // Build from components
  if (bareData.protocol && bareData.host && bareData.path) {
    const port = bareData.port ? `:${bareData.port}` : '';
    const urlStr = `${bareData.protocol}//${bareData.host}${port}${bareData.path}`;
    try {
      return new URL(urlStr);
    } catch (_e) {
      throw new BareError(400, 'INVALID_BARE_COMPONENTS', 'Cannot construct valid URL from bare components');
    }
  }

  throw new BareError(400, 'MISSING_BARE_URL', 'x-bare-url header is required');
}

/**
 * Build headers for outgoing request
 */
function buildOutgoingHeaders(bareData, originalRequest) {
  const headers = new Headers();

  // Add bare headers
  for (const [key, value] of Object.entries(bareData.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v);
      }
    } else {
      headers.set(key, value);
    }
  }

  // Forward specified headers from original request
  for (const header of bareData.forwardHeaders) {
    const value = originalRequest.headers.get(header);
    if (value !== null) {
      headers.set(header, value);
    }
  }

  return headers;
}

/**
 * Build response headers for bare response
 */
function buildBareResponseHeaders(response, corsHeaders, stripHeaders) {
  const headers = new Headers(corsHeaders);
  
  // Collect original response headers
  const responseHeaders = {};
  for (const [key, value] of response.headers.entries()) {
    const lowerKey = key.toLowerCase();
    
    // Skip headers we want to strip
    if (stripHeaders.includes(lowerKey)) {
      continue;
    }

    // Handle multiple values
    if (responseHeaders[key]) {
      if (Array.isArray(responseHeaders[key])) {
        responseHeaders[key].push(value);
      } else {
        responseHeaders[key] = [responseHeaders[key], value];
      }
    } else {
      responseHeaders[key] = value;
    }
  }

  // Set bare response headers
  headers.set('x-bare-status', response.status.toString());
  headers.set('x-bare-status-text', response.statusText);
  headers.set('x-bare-headers', JSON.stringify(responseHeaders));

  // Pass through content headers
  const contentType = response.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    headers.set('content-length', contentLength);
  }

  const contentEncoding = response.headers.get('content-encoding');
  if (contentEncoding) {
    headers.set('content-encoding', contentEncoding);
  }

  return headers;
}

/**
 * Handle Bare v3 request
 */
export async function handleBareV3Request(request, env, corsHeaders, stripHeaders) {
  try {
    // Parse bare headers
    const bareData = parseBareHeaders(request);
    
    // Build target URL
    const targetUrl = buildTargetUrl(bareData);
    
    // Validate URL protocol
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      throw new BareError(400, 'INVALID_PROTOCOL', 'Only HTTP and HTTPS protocols are supported');
    }

    // Build outgoing headers
    const outgoingHeaders = buildOutgoingHeaders(bareData, request);

    // Prepare fetch options
    const fetchOptions = {
      method: request.method,
      headers: outgoingHeaders,
      redirect: 'manual', // Handle redirects manually to preserve headers
    };

    // Include body for methods that support it
    if (!['GET', 'HEAD'].includes(request.method)) {
      fetchOptions.body = request.body;
      fetchOptions.duplex = 'half';
    }

    // Fetch target URL
    const response = await fetch(targetUrl.toString(), fetchOptions);

    // Build response headers
    const responseHeaders = buildBareResponseHeaders(response, corsHeaders, stripHeaders);

    // Return proxied response
    return new Response(response.body, {
      status: 200, // Bare protocol always returns 200, actual status in headers
      headers: responseHeaders
    });

  } catch (error) {
    if (error instanceof BareError) {
      return error.toResponse(corsHeaders);
    }

    console.error('Bare v3 Error:', error);
    
    return new Response(JSON.stringify({
      error: true,
      code: 'FETCH_ERROR',
      message: error.message || 'Failed to fetch target URL',
      id: crypto.randomUUID()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * Handle legacy Bare request (v1/v2 compatibility)
 */
export async function handleBareRequest(request, env, corsHeaders, stripHeaders) {
  // Legacy format uses query parameters or different header format
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url') || request.headers.get('x-bare-url');

  if (!targetUrl) {
    // Return info for bare root
    return new Response(JSON.stringify({
      versions: ['v1', 'v2', 'v3'],
      language: 'Cloudflare Workers',
      project: {
        name: 'openbare-edge',
        version: '1.0.0'
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }

  // Forward to v3 handler
  return handleBareV3Request(request, env, corsHeaders, stripHeaders);
}

/**
 * Custom Bare Error class
 */
class BareError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'BareError';
  }

  toResponse(corsHeaders = {}) {
    return new Response(JSON.stringify({
      error: true,
      code: this.code,
      message: this.message,
      id: crypto.randomUUID()
    }), {
      status: this.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

export { BareError, parseBareHeaders, buildTargetUrl };
