import "server-only";

type FirebaseLookupResponse = {
  users?: Array<{ localId?: string; email?: string }>;
  error?: { message?: string };
};

export async function verifyFirebaseBearer(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const apiKey = process.env.NEXT_PUBLIC_FB_API_KEY?.trim();
  if (!token || !apiKey) return null;

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken: token }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const data = await response.json() as FirebaseLookupResponse;
  const user = data.users?.[0];
  return user?.localId ? { uid: user.localId, email: user.email || null } : null;
}
