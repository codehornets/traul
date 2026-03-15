import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { writePid, readPid, removePid, isProcessAlive } from "../../src/daemon/pid";

describe("PID file management", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "traul-pid-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes and reads PID file", () => {
    const pidPath = join(dir, "daemon.pid");
    writePid(pidPath, 12345);
    expect(readPid(pidPath)).toBe(12345);
  });

  it("returns null when PID file does not exist", () => {
    expect(readPid(join(dir, "nope.pid"))).toBeNull();
  });

  it("removes PID file", () => {
    const pidPath = join(dir, "daemon.pid");
    writePid(pidPath, 12345);
    removePid(pidPath);
    expect(existsSync(pidPath)).toBe(false);
  });

  it("removePid is a no-op when file does not exist", () => {
    removePid(join(dir, "nope.pid")); // should not throw
  });

  it("isProcessAlive returns true for current process", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it("isProcessAlive returns false for non-existent PID", () => {
    expect(isProcessAlive(999999)).toBe(false);
  });
});
