/**
 * Build & deploy the web app to /opt/arclaunch on the HK server.
 *   node ops/deploy-web.mjs            # upload source, docker build on server, restart, verify
 *   node ops/deploy-web.mjs --nginx    # also (re)install nginx conf + open :8080 preview
 */
import { Client } from "ssh2";
import { execSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const WEB = join(ROOT, "web");
const TMP = join(ROOT, "ops", ".tmp");
mkdirSync(TMP, { recursive: true });

const host = process.env.SRV_HOST ?? "45.205.18.104";
const username = process.env.SRV_USER ?? "root";
const privateKey = readFileSync(join(homedir(), ".ssh", "arclaunch_ed25519"));
const withNginx = process.argv.includes("--nginx");

// 1) pack source (no node_modules/.next) — Docker builds on the server.
const tgz = join(TMP, "web-src.tgz");
execSync(`tar -czf "${tgz}" --exclude=node_modules --exclude=.next --exclude=.git -C "${WEB}" .`, { stdio: "inherit" });
console.log("packed", (statSync(tgz).size / 1024 / 1024).toFixed(1), "MB");

const conn = new Client();
const exec = (cmd) =>
  new Promise((res, rej) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return rej(err);
      let out = "";
      stream.on("data", (d) => {
        out += d;
        process.stdout.write(d);
      });
      stream.stderr.on("data", (d) => process.stderr.write(d));
      stream.on("close", (code) => (code === 0 ? res(out) : rej(new Error(`exit ${code}: ${cmd.slice(0, 60)}`))));
    });
  });
const sftp = () => new Promise((res, rej) => conn.sftp((e, s) => (e ? rej(e) : res(s))));
const put = (s, local, remote) =>
  new Promise((res, rej) => {
    const ws = s.createWriteStream(remote);
    ws.on("close", res).on("error", rej);
    createReadStream(local).pipe(ws);
  });

conn.on("ready", async () => {
  try {
    await exec("mkdir -p /opt/arclaunch/web /opt/arclaunch/nginx");
    const s = await sftp();
    await put(s, tgz, "/opt/arclaunch/web-src.tgz");
    await put(s, join(ROOT, "ops/deploy/docker-compose.yml"), "/opt/arclaunch/docker-compose.yml");
    await put(s, join(ROOT, "ops/deploy/nginx-arclaunch.conf"), "/opt/arclaunch/nginx/arclaunch.conf");
    console.log("uploaded");

    await exec(`set -e
cd /opt/arclaunch
rm -rf web && mkdir web && tar -xzf web-src.tgz -C web && rm web-src.tgz
docker compose build --pull web 2>&1 | tail -n 5
docker compose up -d web
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/ || true)
  [ "$code" = "200" ] && break; sleep 2
done
echo "web http_code=$code"
docker ps --filter name=arclaunch --format '{{.Names}} {{.Status}}'`);

    if (withNginx) {
      await exec(`set -e
cp /opt/arclaunch/nginx/arclaunch.conf /etc/nginx/conf.d/arclaunch.conf
nginx -t 2>&1 | tail -n 1
systemctl reload nginx
ufw allow 8080/tcp >/dev/null && echo "ufw: 8080 open"
echo "preview http_code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/)"`);
    }
    console.log("DEPLOY_OK");
  } catch (e) {
    console.error("DEPLOY_FAILED:", e.message);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
}).on("error", (e) => {
  console.error("ssh error:", e.message);
  process.exit(1);
});
conn.connect({ host, username, privateKey, readyTimeout: 30000 });
