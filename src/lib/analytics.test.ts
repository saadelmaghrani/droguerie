import { describe, expect, it } from "vitest";
import { classifyPath, cleanPath, deviceType, isBot, moroccoDay, percentChange, referrerHost } from "./analytics";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; SM-A556B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 14; SM-X210) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

describe("isBot", () => {
  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "facebookexternalhit/1.1",
    "WhatsApp/2.24.1 A",
    "curl/8.4.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0 Safari/537.36",
    "",
  ])("robot : %s", (ua) => expect(isBot(ua)).toBe(true));
  it.each([IPHONE, ANDROID, MAC])("navigateur réel", (ua) => expect(isBot(ua)).toBe(false));
});

describe("deviceType", () => {
  it("téléphone", () => {
    expect(deviceType(IPHONE)).toBe("mobile");
    expect(deviceType(ANDROID)).toBe("mobile");
  });
  it("tablette", () => expect(deviceType(ANDROID_TABLET)).toBe("tablet"));
  it("ordinateur", () => expect(deviceType(MAC)).toBe("desktop"));
});

describe("referrerHost", () => {
  it("garde seulement le nom du site extérieur", () => {
    expect(referrerHost("https://www.google.com/search?q=javel+casablanca", "droguerie.ma")).toBe("google.com");
  });
  it("ignore le site lui-même et les valeurs invalides", () => {
    expect(referrerHost("https://www.droguerie.ma/produits", "droguerie.ma")).toBeNull();
    expect(referrerHost("pas une url", null)).toBeNull();
    expect(referrerHost("", null)).toBeNull();
  });
});

describe("classifyPath / cleanPath", () => {
  it("reconnaît fiches produit et catégories", () => {
    expect(classifyPath("/produits/eponge-x10")).toEqual({ kind: "product", slug: "eponge-x10" });
    expect(classifyPath("/categories/peinture")).toEqual({ kind: "category", slug: "peinture" });
    expect(classifyPath("/produits")).toEqual({ kind: "other" });
    expect(classifyPath("/")).toEqual({ kind: "other" });
  });
  it("retire les paramètres et refuse l'admin, l'API, les adresses externes", () => {
    expect(cleanPath("/produits?q=javel")).toBe("/produits");
    expect(cleanPath("/admin/produits")).toBeNull();
    expect(cleanPath("/api/events")).toBeNull();
    expect(cleanPath("//evil.com")).toBeNull();
    expect(cleanPath("https://evil.com")).toBeNull();
    expect(cleanPath(42)).toBeNull();
  });
});

describe("moroccoDay / percentChange", () => {
  it("jour au fuseau du Maroc", () => {
    expect(moroccoDay(new Date("2026-11-21T23:30:00Z"))).toBe("2026-11-22"); // UTC+1 au Maroc
  });
  it("variation en %", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
  });
});
