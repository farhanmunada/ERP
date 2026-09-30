import { execSync } from 'node:child_process';

const ports = process.argv
  .slice(2)
  .map(Number)
  .filter((value) => Number.isInteger(value) && value > 0 && value < 65536);

if (ports.length === 0) {
  console.log('[free-port] tidak ada port yang diberikan');
  process.exit(0);
}

function findPids(port: number): number[] {
  if (process.platform === 'win32') {
    try {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess"`,
        { encoding: 'utf8' },
      );
      return out
        .split(/\s+/)
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0);
    } catch {
      return [];
    }
  }

  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
    return out
      .split(/\s+/)
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

let killedAny = false;

for (const port of ports) {
  const pids = [...new Set(findPids(port))];
  if (pids.length === 0) {
    console.log(`[free-port] port ${port}: bebas`);
    continue;
  }

  for (const pid of pids) {
    try {
      process.kill(pid);
      killedAny = true;
      console.log(`[free-port] port ${port}: proses ${pid} dimatikan`);
    } catch {
      console.log(`[free-port] port ${port}: gagal mematikan proses ${pid} (butuh hak admin?)`);
    }
  }
}

if (killedAny) {
  // Beri waktu OS melepas socket sebelum proses berikutnya bind.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log('[free-port] selesai, port siap dipakai');
}
