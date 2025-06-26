function handleUserCookie(user) {
  document.cookie = [
    `currentUser=${encodeURIComponent(JSON.stringify(user))}`,
    'path=/'
  ].join('; ');
}

export async function register(username, email, password) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, email, password })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Registration failed');
  }

  handleUserCookie(data.user);
  return data;
}

export async function login(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Login failed');
  }

  handleUserCookie(data.user);
  return data;
}

export function logout() {
  document.cookie = 'currentUser=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  }).finally(() => {
    window.location.href = 'login.html';
  });
}
