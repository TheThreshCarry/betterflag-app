import { afterEach, describe, expect, it } from "vitest";

import {
  extForContentType,
  isMediaContentType,
  keyFromPublicUrl,
  orgLogoKey,
  profileAvatarKey,
  projectPictureKey,
  publicMediaUrl,
} from "@/lib/r2";

describe("media content types", () => {
  it("accepts png/jpeg/webp/svg", () => {
    expect(isMediaContentType("image/png")).toBe(true);
    expect(isMediaContentType("image/jpeg")).toBe(true);
    expect(isMediaContentType("image/webp")).toBe(true);
    expect(isMediaContentType("image/svg+xml")).toBe(true);
    expect(isMediaContentType("image/gif")).toBe(false);
    expect(isMediaContentType("application/pdf")).toBe(false);
  });

  it("maps content types to extensions", () => {
    expect(extForContentType("image/png")).toBe("png");
    expect(extForContentType("image/jpeg")).toBe("jpg");
    expect(extForContentType("image/webp")).toBe("webp");
    expect(extForContentType("image/svg+xml")).toBe("svg");
  });
});

describe("publicMediaUrl", () => {
  it("joins base + key and adds cache-bust query", () => {
    expect(publicMediaUrl("https://media.betterflag.app/", "orgs/abc/logo.png", 42)).toBe(
      "https://media.betterflag.app/orgs/abc/logo.png?v=42",
    );
  });
});

describe("object keys", () => {
  it("builds org logo, project picture, and profile avatar keys", () => {
    expect(orgLogoKey("org-1", "png")).toBe("orgs/org-1/logo.png");
    expect(projectPictureKey("proj-1", "webp")).toBe("projects/proj-1/picture.webp");
    expect(profileAvatarKey("user-1", "jpg")).toBe("users/user-1/avatar.jpg");
  });
});

describe("keyFromPublicUrl", () => {
  const prev = process.env.R2_PUBLIC_BASE_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.R2_PUBLIC_BASE_URL;
    else process.env.R2_PUBLIC_BASE_URL = prev;
  });

  it("extracts key when URL matches public base", () => {
    process.env.R2_PUBLIC_BASE_URL = "https://media.betterflag.app";
    expect(keyFromPublicUrl("https://media.betterflag.app/orgs/x/logo.png?v=1")).toBe(
      "orgs/x/logo.png",
    );
  });

  it("returns null for foreign hosts or empty", () => {
    process.env.R2_PUBLIC_BASE_URL = "https://media.betterflag.app";
    expect(keyFromPublicUrl("https://evil.example/orgs/x/logo.png")).toBeNull();
    expect(keyFromPublicUrl(null)).toBeNull();
  });
});
