import { describe, expect, it } from "vitest";
import { parseSocialUrl } from "./platforms";

describe("parseSocialUrl", () => {
  it("detecta Instagram reel", () => {
    const r = parseSocialUrl("https://www.instagram.com/reel/C1abcDEF/");
    expect(r.ok && r.platform).toBe("instagram");
  });
  it("detecta TikTok video", () => {
    const r = parseSocialUrl("https://www.tiktok.com/@kimedia/video/7301234567890");
    expect(r.ok && r.postId).toBe("7301234567890");
  });
  it("detecta YouTube watch y youtu.be", () => {
    expect(parseSocialUrl("https://youtube.com/watch?v=dQw4w9WgXcQ").ok).toBe(true);
    const r = parseSocialUrl("youtu.be/dQw4w9WgXcQ");
    expect(r.ok && r.platform).toBe("youtube");
  });
  it("detecta X y twitter.com", () => {
    const r = parseSocialUrl("https://twitter.com/user/status/12345");
    expect(r.ok && r.platform).toBe("x");
  });
  it("detecta Facebook post", () => {
    expect(parseSocialUrl("https://www.facebook.com/page/posts/pfbid0abc").ok).toBe(true);
  });
  it("rechaza perfiles", () => {
    expect(parseSocialUrl("https://www.instagram.com/kimedia/").ok).toBe(false);
    expect(parseSocialUrl("https://x.com/kimedia").ok).toBe(false);
  });
  it("rechaza plataformas no soportadas", () => {
    expect(parseSocialUrl("https://linkedin.com/posts/abc").ok).toBe(false);
  });
});
