export function isStrongPassword(password: unknown): password is string {
  return typeof password === "string" && password.length >= 12 && password.length <= 128 &&
    /[a-z]/.test(password) && /[A-Z]/.test(password) && /(?:\d|[^A-Za-z0-9])/.test(password);
}

export function validateRegistrationInput(value: Record<string, unknown>) {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim() : "";
  return name.length >= 1 && name.length <= 80 && !/[\u0000-\u001f\u007f]/.test(name) &&
    email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && isStrongPassword(value.password);
}
