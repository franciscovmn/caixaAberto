const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt?: string;
};

export type LoginResult = {
  token: string;
  user: AuthUser;
};

function getErrorMessage(data: unknown) {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }

  const body = data as Record<string, unknown>;

  if (typeof body.erro === 'string') {
    return body.erro;
  }

  if (typeof body.error === 'string') {
    return body.error;
  }

  return undefined;
}

async function readResponse(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  let response: Response;

  try {
    response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor');
  }

  const data: unknown = await readResponse(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(data) ?? 'Não foi possível realizar o login');
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('Resposta inválida do servidor');
  }

  const result = data as Partial<LoginResult>;

  if (typeof result.token !== 'string' || typeof result.user !== 'object' || result.user === null) {
    throw new Error('Resposta inválida do servidor');
  }

  return result as LoginResult;
}

export async function logoutRequest(token: string) {
  try {
    await fetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    return;
  }
}
