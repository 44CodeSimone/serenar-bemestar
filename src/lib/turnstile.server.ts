const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TIMEOUT_MS = 8_000;
const TURNSTILE_VERIFICATION_ERROR = "turnstile_verification_failed";

type VerifyTurnstileTokenParams = {
  token: string;
  expectedAction?: string;
  allowedHostnames?: readonly string[];
};

function isTurnstileResponse(
  value: unknown,
): value is { success: boolean; action?: string; hostname?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const response = Object.fromEntries(Object.entries(value));
  return (
    typeof response.success === "boolean" &&
    (response.action === undefined || typeof response.action === "string") &&
    (response.hostname === undefined || typeof response.hostname === "string")
  );
}

export async function verifyTurnstileToken({
  token,
  expectedAction,
  allowedHostnames,
}: VerifyTurnstileTokenParams): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret || !token.trim()) {
    throw new Error(TURNSTILE_VERIFICATION_ERROR);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(TURNSTILE_VERIFICATION_ERROR);
    }

    const result: unknown = await response.json();

    if (
      !isTurnstileResponse(result) ||
      result.success !== true ||
      (expectedAction !== undefined && result.action !== expectedAction) ||
      (allowedHostnames !== undefined &&
        (typeof result.hostname !== "string" || !allowedHostnames.includes(result.hostname)))
    ) {
      throw new Error(TURNSTILE_VERIFICATION_ERROR);
    }
  } catch {
    throw new Error(TURNSTILE_VERIFICATION_ERROR);
  } finally {
    clearTimeout(timeoutId);
  }
}
