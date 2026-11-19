/**
 * What Supabase puts in the URL when an OAuth round trip fails. Kept free of any client code
 * so it can be unit-tested.
 */
export type AuthReturnProblem = "identity_already_exists" | "other";

export function authReturnProblem(search: string, hash: string): AuthReturnProblem | null {
  const params = new URLSearchParams(search);
  // Implicit flows (and some errors) come back in the fragment rather than the query string.
  new URLSearchParams(hash.replace(/^#/, "")).forEach((value, key) => params.set(key, value));

  const code = params.get("error_code");
  const description = params.get("error_description") ?? "";
  if (code === "identity_already_exists" || /already linked/i.test(description)) return "identity_already_exists";
  return code || params.get("error") ? "other" : null;
}
