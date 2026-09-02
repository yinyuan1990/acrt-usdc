/**
 * One-off: switch E:\soft\huazongnft\scripts\*-hk.py from root password → SSH key auth.
 * - connect(..., password=X, ...) → connect(..., key_filename=KEY_FILE, ...)
 * - hardcoded PASSWORD/pwd/HK_PASS literals → None / "" (secrets out of source)
 * - ensures `import os` + KEY_FILE constant
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "E:/soft/huazongnft/scripts";
const KEY_LINE = 'KEY_FILE = os.path.expanduser("~/.ssh/arclaunch_ed25519")  # SSH key auth (root password login is being retired)';
let changed = 0;

for (const f of readdirSync(DIR).filter((n) => n.endsWith("-hk.py"))) {
  const p = join(DIR, f);
  const src = readFileSync(p, "utf8");
  let out = src;

  // connect calls
  out = out.replace(/password=PASSWORD,/g, "key_filename=KEY_FILE,");
  out = out.replace(/password=HK\["pwd"\],/g, "key_filename=KEY_FILE,");
  out = out.replace(/password=s\["pwd"\],/g, "key_filename=KEY_FILE,");
  out = out.replace(/password=HK_PASS,/g, "key_filename=KEY_FILE,");

  // secrets out of source
  out = out.replace(/^(\s*PASSWORD\s*=\s*)"[^"]*"/gm, '$1None  # retired: key auth via KEY_FILE');
  out = out.replace(/^(\s*HK_PASS\s*=\s*)"[^"]*"/gm, '$1None  # retired: key auth via KEY_FILE');
  out = out.replace(/("pwd":\s*)"[^"]*"/g, '$1None');

  if (out !== src) {
    if (!/^import os\b/m.test(out)) out = out.replace(/^(import [^\n]+\n)/m, "import os\n$1");
    if (!out.includes("KEY_FILE =")) {
      // insert after the last top-level import block
      const lines = out.split("\n");
      let idx = 0;
      for (let i = 0; i < lines.length; i++) if (/^(import |from )/.test(lines[i])) idx = i + 1;
      lines.splice(idx, 0, "", KEY_LINE);
      out = lines.join("\n");
    }
    writeFileSync(p, out);
    changed++;
    console.log("updated", f);
  }
}
console.log(`done: ${changed} scripts migrated`);
