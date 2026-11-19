import { describe, expect, it, vi } from "vitest";

import { retrying } from "./retrying";

const noWait = () => Promise.resolve();

describe("retrying", () => {
  it("returns the first success without waiting", async () => {
    const read = vi.fn().mockResolvedValue("sheet");
    const wait = vi.fn(noWait);
    await expect(retrying(read, [10, 20], wait)).resolves.toBe("sheet");
    expect(read).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("tries again after each delay until a read succeeds", async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue("sheet");
    const wait = vi.fn(noWait);
    await expect(retrying(read, [10, 20, 30], wait)).resolves.toBe("sheet");
    expect(read).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[10], [20]]);
  });

  it("gives up after the last delay with the last error", async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockRejectedValue(new Error("last"));
    await expect(retrying(read, [10, 20], noWait)).rejects.toThrow("last");
    expect(read).toHaveBeenCalledTimes(3);
  });
});
