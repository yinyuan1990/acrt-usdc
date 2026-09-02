/**
 * Deploy the ArcLaunch stack to /opt/arclaunch on the HK server.
 *   node ops/deploy.mjs [--services web,indexer] [--nginx] [--no-build]
 * Uploads source for the chosen services + compose file (+ nginx conf), builds on the server, restarts, verifies.
 */
import { Client } from "ssh2";
import { execSync } from "node:child_process";
import { createReadStream, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TMP = join(ROOT, "ops", ".tmp");
mkdirSync(TMP, { recursive: true });

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : null; };
const services = (flag("--services") ?? "web,indexer").split(",").filter(Boolean);
const withNginx = args.includes("--nginx");
const noBuild = args.includes("--no-build");

const host = process.env.SRV_HOST ?? "45.205.18.104";
const username = process.env.SRV_USER ?? "root";
const privateKey = readFileSync(join(homedir(), ".ssh", "arclaunch_ed25519"));

const SRC = { web: { dir: "web", ex: ["node_modules", ".next", "scripts"] }, indexer: { dir: "indexer", ex: ["node_modules", "dist"] } };

const conn = new Client();
const exec = (cmd) => new Promise((res, rej) => {
  conn.exec(cmd, (err, stream) => {
    if (err) return rej(err);
    stream.on("data", (d) => process.stdout.write(d));
    stream.stderr.on("data", (d) => process.stderr.write(d));
    stream.on("close", (code) => (code === 0 ? res() : rej(new Error(`exit ${code}`))));
  });
});
const sftp = () => new Promise((res, rej) => conn.sftp((e, s) => (e ? rej(e) : res(s))));
const put = (s, local, remote) => new Promise((res, rej) => {
  const ws = s.createWriteStream(remote);
  ws.on("close", res).on("error", rej);
  createReadStream(local).pipe(ws);
});

conn.on("ready", async () => {
  try {
    await exec("mkdir -p /opt/arclaunch/nginx /opt/arclaunch/contracts/deployments");
    const s = await sftp();
    for (const svc of services) {
      const { dir, ex } = SRC[svc];
      const tgz = join(TMP, `${dir}-src.tgz`);
      execSync(`tar -czf "${tgz}" ${[".git", ...ex].map((e) => `--exclude=${e}`).join(" ")} -C "${join(ROOT, dir)}" .`, { stdio: "inherit" });
      await put(s, tgz, `/opt/arclaunch/${dir}-src.tgz`);
      await exec(`cd /opt/arclaunch && rm -rf ${dir} && mkdir ${dir} && tar -xzf ${dir}-src.tgz -C ${dir} && rm ${dir}-src.tgz`);
      console.log(`uploaded ${dir} (${(statSync(tgz).size / 1024).toFixed(0)} KB)`);
    }
    await put(s, join(ROOT, "ops/deploy/docker-compose.yml"), "/opt/arclaunch/docker-compose.yml");
    await put(s, join(ROOT, "ops/deploy/nginx-arclaunch.conf"), "/opt/arclaunch/nginx/arclaunch.conf");
    await put(s, join(ROOT, "contracts/deployments/arc-testnet.json"), "/opt/arclaunch/contracts/deployments/arc-testnet.json");

    const list = services.join(" ");
    await exec(`set -e
cd /opt/arclaunch
set -a; . ./.env; set +a
${noBuild ? "" : `docker compose build ${list} 2>&1 | grep -E 'Built|ERROR|error' || true`}
docker compose up -d --remove-orphans db ${list}
sleep 3
for i in $(seq 1 40); do
  ok=1
  ${services.includes("web") ? `[ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/)" = 200 ] || ok=0` : ""}
  ${services.includes("indexer") ? `[ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3101/api/health)" = 200 ] || ok=0` : ""}
  [ $ok = 1 ] && break; sleep 2
done
echo "web:     $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/)"
echo "indexer: $(curl -s http://127.0.0.1:3101/api/health)"
docker ps --filter name=arclaunch --format '{{.Names}}  {{.Status}}'`);

    if (withNginx) {
      await exec(`set -e
cp /opt/arclaunch/nginx/arclaunch.conf /etc/nginx/conf.d/arclaunch.conf
nginx -t 2>&1 | tail -n 1 && systemctl reload nginx
echo "public api: $(curl -s https://launch.hzmrbq.com/api/health)"`);
    }
    console.log("DEPLOY_OK");
  } catch (e) {
    console.error("DEPLOY_FAILED:", e.message);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
}).on("error", (e) => { console.error("ssh error:", e.message); process.exit(1); });
conn.connect({ host, username, privateKey, readyTimeout: 30000 });
