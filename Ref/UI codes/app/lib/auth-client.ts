export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("pos_token", token);
  }
}

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("pos_token");
  }
  return null;
}

export function removeToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("pos_token");
  }
}
