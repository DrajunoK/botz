import { describe, expect, it } from "vitest";
import { authReturnProblem } from "@/net/authReturn";

describe("authReturnProblem", () => {
  it("is null on a normal page load or a successful return", () => {
    expect(authReturnProblem("", "")).toBeNull();
    expect(authReturnProblem("?code=abc123", "")).toBeNull();
  });

  it("recognises a Google account that already belongs to another profile", () => {
    expect(authReturnProblem("?error=server_error&error_code=identity_already_exists", "")).toBe("identity_already_exists");
    expect(authReturnProblem("", "#error=server_error&error_description=Identity+is+already+linked+to+another+user")).toBe(
      "identity_already_exists",
    );
  });

  it("reports any other failure, wherever it is in the URL", () => {
    expect(authReturnProblem("?error=access_denied", "")).toBe("other");
    expect(authReturnProblem("", "#error_code=bad_oauth_callback")).toBe("other");
  });
});
