import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("resolve conflitos do tailwind", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
  it("ignora valores falsos", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
