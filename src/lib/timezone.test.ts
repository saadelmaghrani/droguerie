import { describe, expect, it } from "vitest";
import { localMidnightUtc, offsetSegments, toSqlTimestamp, utcOffsetMinutes } from "./timezone";

describe("fuseau du Maroc (calculé par Node, pas par PostgreSQL)", () => {
  it("UTC+1 hors Ramadan, UTC+0 pendant le Ramadan", () => {
    expect(utcOffsetMinutes(new Date("2026-11-21T23:30:00Z"))).toBe(60);
    expect(utcOffsetMinutes(new Date("2026-03-01T12:00:00Z"))).toBe(0);
    expect(utcOffsetMinutes(new Date("2026-04-15T12:00:00Z"))).toBe(60);
  });

  it("minuit local → instant UTC", () => {
    expect(localMidnightUtc("2026-11-22").toISOString()).toBe("2026-11-21T23:00:00.000Z");
    expect(localMidnightUtc("2026-03-01").toISOString()).toBe("2026-03-01T00:00:00.000Z"); // Ramadan : UTC+0
  });

  it("découpe une année en périodes de décalage constant (2 changements autour du Ramadan)", () => {
    const segments = offsetSegments(new Date("2025-12-01T00:00:00Z"), new Date("2026-11-22T00:00:00Z"));
    expect(segments.map((s) => s.offsetMinutes)).toEqual([60, 0, 60]);
    // Chaque changement tombe à l'heure exacte où le décalage change.
    for (const s of segments.slice(1)) {
      expect(utcOffsetMinutes(s.from)).toBe(s.offsetMinutes);
      expect(utcOffsetMinutes(new Date(s.from.getTime() - 3_600_000))).not.toBe(s.offsetMinutes);
    }
  });

  it("période sans changement : une seule période", () => {
    expect(offsetSegments(new Date("2026-10-23T00:00:00Z"), new Date("2026-11-22T00:00:00Z"))).toHaveLength(1);
  });

  it("format SQL sans fuseau", () => {
    expect(toSqlTimestamp(new Date("2026-11-21T23:00:00.000Z"))).toBe("2026-11-21 23:00:00.000");
  });
});
