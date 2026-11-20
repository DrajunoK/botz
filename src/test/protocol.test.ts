import { describe, expect, it } from "vitest";
import { makeRoomCode, normalizeRoomCode, parseEnvelope, roomFromLink, roomLink } from "@/net/protocol";

describe("room codes", () => {
  it("makes 4 characters without lookalikes", () => {
    for (let i = 0; i < 200; i++) expect(makeRoomCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  });
  it("cleans what the player typed", () => {
    expect(normalizeRoomCode(" ab-3k ")).toBe("AB3K");
    expect(normalizeRoomCode("AB3")).toBeNull();
    expect(normalizeRoomCode("AB3O")).toBeNull(); // O is not in the alphabet
  });
});

describe("parseEnvelope", () => {
  it("accepts well-formed messages", () => {
    expect(parseEnvelope({ from: "a", msg: { t: "aims", m: 9, turn: 2, shots: [{ index: 0, vx: 1, vy: 2 }] } })).not.toBeNull();
    expect(parseEnvelope({ from: "a", msg: { t: "start", game: "soccer", seed: 5 } })).not.toBeNull();
    expect(parseEnvelope({ from: "a", msg: { t: "leave" } })).not.toBeNull();
    expect(parseEnvelope({ from: "a", msg: { t: "snap", m: 1, turn: 2, values: [1, 2.5, -3] } })).not.toBeNull();
    expect(parseEnvelope({ from: "a", msg: { t: "go", seed: 4 } })).not.toBeNull();
  });
  it("drops anything malformed", () => {
    expect(parseEnvelope(null)).toBeNull();
    expect(parseEnvelope({ from: "a", msg: { t: "start", game: "chess", seed: 1 } })).toBeNull();
    expect(parseEnvelope({ from: "a", msg: { t: "aims", m: 9, turn: 1, shots: [{ index: 0, vx: "x", vy: 1 }] } })).toBeNull();
    expect(parseEnvelope({ from: "a", msg: { t: "snap", m: 1, turn: 2, values: [1, "x"] } })).toBeNull();
    expect(parseEnvelope({ from: "a", msg: { t: "aims", turn: 1, shots: [] } })).toBeNull(); // no match id
    expect(parseEnvelope({ from: 3, msg: { t: "ready" } })).toBeNull();
    expect(parseEnvelope({ from: "a", msg: { t: "boom" } })).toBeNull();
  });
});

describe("invite links", () => {
  it("round-trips a room code", () => {
    expect(roomFromLink(new URL(roomLink("https://botz.pomponlabs.com", "AB3K")).search)).toBe("AB3K");
    expect(roomFromLink("?room=zz")).toBeNull();
    expect(roomFromLink("")).toBeNull();
  });
});
