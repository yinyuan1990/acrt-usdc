/** Pull contracts/deployments/arc-testnet.json from the server and write it (UTF-8) to both local copies. */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const raw = execFileSync("node", [resolve(ROOT, "ops/ssh.mjs"), "cat /opt/arclaunch/contracts/deployments/arc-testnet.json"], { encoding: "utf8" });
const json = JSON.stringify(JSON.parse(raw), null, 2) + "\n";
for (const p of ["contracts/deployments/arc-testnet.json", "web/src/lib/deployments.arc-testnet.json"]) writeFileSync(resolve(ROOT, p), json);
console.log(json);
