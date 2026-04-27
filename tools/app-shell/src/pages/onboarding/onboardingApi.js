export function buildAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readJsonResponse(response, fallbackMessage) {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || fallbackMessage);
  }
  return data;
}

export async function registerAccount(fetchImpl, baseUrl, form) {
  const response = await fetchImpl(`${baseUrl}/sws/go/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  return readJsonResponse(response, 'No se pudo crear la cuenta.');
}

export async function loginAccount(fetchImpl, baseUrl, form) {
  const response = await fetchImpl(`${baseUrl}/sws/go/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  return readJsonResponse(response, 'Credenciales invalidas.');
}

export async function fetchAccount(fetchImpl, baseUrl, token) {
  const response = await fetchImpl(`${baseUrl}/sws/go/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return readJsonResponse(response, 'Invalid platform session.');
}

export async function fetchEnvironments(fetchImpl, baseUrl, token) {
  const response = await fetchImpl(`${baseUrl}/sws/go/environments`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await readJsonResponse(response, 'Could not load environments.');
  return data.environments || [];
}

export async function loginEnvironment(fetchImpl, baseUrl, token, env) {
  const userId = encodeURIComponent(env.adminUserId);
  const response = await fetchImpl(`${baseUrl}/sws/go/login?userId=${userId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return readJsonResponse(response, 'Login failed.');
}

export async function runOnboardingStream(fetchImpl, baseUrl, token, form, onMessage) {
  const response = await fetchImpl(`${baseUrl}/sws/go/onboarding`, {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify({
      clientName: form.clientName,
      currency: form.currency,
      language: form.language,
      countryCode: form.countryCode,
    }),
  });

  if (!response.body?.getReader) {
    throw new Error('Onboarding response stream is not available.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    if (done) buffer += decoder.decode();

    const lines = buffer.split('\n');
    buffer = done ? '' : lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      onMessage?.(message);
      if (message.type === 'result') {
        finalResult = message;
      }
    }

    if (done) break;
  }

  if (!finalResult) {
    throw new Error('Onboarding finished without a result message.');
  }
  return finalResult;
}
