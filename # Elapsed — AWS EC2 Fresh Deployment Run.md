# Elapsed — AWS EC2 Fresh Deployment Runbook

> الهدف: حذف نسخة المشروع الحالية من EC2، إعادة Clone من GitHub من الصفر، تشغيل PostgreSQL + Worker + Web + Nginx داخل Docker، ثم التحقق من الموقع.
>
> **Project:** elapsed  
> **Server:** `13.62.74.24`  
> **Server path:** `/opt/elapsed`  
> **GitHub repo:** `Yasser-Alnajjar/elapsed`  
> **Branch:** `main`  
> **AWS Region:** `eu-north-1`  
> **EC2:** `i-093d3f4c0c8a99951`  
> **Security Group:** `launch-wizard-1` / `sg-0427ab1f35847c4f6`

---

## 0. Important — what this reset deletes

The reset below removes the current project directory:

```bash
sudo rm -rf /opt/elapsed

If you also remove the Docker/PostgreSQL volume, all production database data will be deleted.

For a completely fresh deployment including an empty database, the command is:

docker compose -f /opt/elapsed/docker-compose.prod.yml --env-file /opt/elapsed/.env.prod down -v

But because /opt/elapsed is deleted, the safer order is:

Stop/remove the current containers while the compose file still exists.
Decide whether to preserve or delete the PostgreSQL volume.
Delete /opt/elapsed.
Clone again.
If you want a truly clean database

Run:

cd /opt/elapsed
docker compose -f docker-compose.prod.yml --env-file .env.prod down -v --remove-orphans

Do not use -v if you need the existing database.

1. Connect to EC2

From your Mac:

ssh -i /path/to/your-key.pem ubuntu@13.62.74.24

Then:

cd /opt/elapsed
2. Stop the current deployment

First inspect:

docker ps

Then stop/remove the current stack:

cd /opt/elapsed

docker compose -f docker-compose.prod.yml --env-file .env.prod down --remove-orphans
For a completely fresh database

Use this instead:

docker compose -f docker-compose.prod.yml --env-file .env.prod down -v --remove-orphans

Check:

docker ps -a
docker volume ls
3. Delete the old project
sudo rm -rf /opt/elapsed

Confirm:

ls -la /opt

elapsed should no longer exist.

4. Verify GitHub SSH access

Before cloning:

ssh -T git@github.com

Expected:

Hi Yasser-Alnajjar/elapsed! You've successfully authenticated...

If GitHub SSH is already configured, continue.

5. Clone the project again
cd /opt

git clone git@github.com:Yasser-Alnajjar/elapsed.git

cd /opt/elapsed

Check:

git branch --show-current
git remote -v

Switch to main if needed:

git checkout main
git pull origin main
6. Check the deployment files

Verify:

ls -la

You should have at least:

docker-compose.prod.yml
apps/
packages/
nginx/
.env.example or deployment documentation

Check the Nginx config:

cat nginx/nginx.conf

The production config should proxy to:

proxy_pass http://web:3000;

Do not use:

proxy_pass http://127.0.0.1:3000;

because Nginx and Web are separate containers.

7. Create production environment file

Create:

nano /opt/elapsed/.env.prod

Use the project's required variables.

Example structure:

POSTGRES_USER=sla
POSTGRES_PASSWORD=REPLACE_WITH_STRONG_PASSWORD
POSTGRES_DB=sla_breach_monitoring

DATABASE_URL=postgresql://sla:REPLACE_WITH_STRONG_PASSWORD@postgres:5432/sla_breach_monitoring

NEXTAUTH_SECRET=REPLACE_WITH_STRONG_SECRET
NEXTAUTH_URL=http://13.62.74.24

INTEGRATION_CONFIG_ENCRYPTION_KEY=REPLACE_WITH_STRONG_SECRET
SMTP_ENCRYPTION_KEY=REPLACE_WITH_STRONG_SECRET
INTEGRATION_TOKEN_ENCRYPTION_KEY=REPLACE_WITH_STRONG_SECRET

TRUSTED_PROXY_COUNT=1

SENTRY_DSN=

WORKER_ACTIVE_POLL_MS=300000
WORKER_RECONCILIATION_MS=3600000
WORKER_LOCK_RETRY_MS=15000
WORKER_LOCK_PING_MS=30000
WORKER_HEALTH_PORT=8081

DEPLOYMENT_SMTP_HOST=
DEPLOYMENT_SMTP_PORT=587
DEPLOYMENT_SMTP_SECURITY=starttls
DEPLOYMENT_SMTP_USER=
DEPLOYMENT_SMTP_PASSWORD=
DEPLOYMENT_SMTP_FROM=

OPS_ALERT_SLACK_WEBHOOK_URL=
OPS_ALERT_EMAIL=

Generate secrets with:

openssl rand -hex 32

Run it several times and use separate values for the required secrets.

Important

For the initial IP-only HTTP deployment:

NEXTAUTH_URL=http://13.62.74.24

Do not use:

NEXTAUTH_URL=https://13.62.74.24

until HTTPS is actually configured.

Never commit .env.prod to Git.

8. Protect the environment file
chmod 600 /opt/elapsed/.env.prod

Check:

ls -l /opt/elapsed/.env.prod
9. Check Docker
docker --version
docker compose version

Check:

docker ps
10. Build and start the production stack

From:

cd /opt/elapsed

Run:

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

Check:

docker ps

Expected architecture:

nginx      0.0.0.0:80->80/tcp
web        3000/tcp
worker     8081/tcp
postgres   5432/tcp

Only Nginx should publish an application port to the host.

11. Check logs

Web:

docker logs --tail=200 web

Worker:

docker logs --tail=200 worker

Nginx:

docker logs --tail=200 nginx

Postgres:

docker logs --tail=200 postgres
12. Verify container health
docker ps

Expected:

web       Up ... (healthy)
worker    Up ... (healthy)
postgres  Up ...
nginx     Up ...

For Web specifically:

docker inspect web --format='{{json .State.Health}}'

The healthcheck must use IPv4 loopback:

http://127.0.0.1:3000/api/health

not:

http://localhost:3000/api/health

Reason: inside the Alpine container, localhost may resolve to IPv6 ::1 while Next.js is listening on IPv4.

13. Run Prisma migrations

The production compose intentionally does not run migrations automatically.

Run:

docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm --user root worker \
  pnpm --filter @sla/db exec prisma migrate deploy

Expected result should indicate migrations were applied or that there are no pending migrations.

Then restart:

docker compose -f docker-compose.prod.yml --env-file .env.prod restart web worker
14. Verify the application locally

Test through Nginx:

curl -i --max-time 10 http://127.0.0.1/api/health

Expected:

HTTP/1.1 200 OK

and:

{"status":"ok","checks":{"database":"ok"}}

Test the public Elastic IP from the server:

curl -i --max-time 10 http://13.62.74.24/api/health

Expected:

HTTP/1.1 200 OK
15. AWS Security Group

The EC2 Security Group is:

launch-wizard-1
sg-0427ab1f35847c4f6

Inbound rules should include:

SSH   TCP   22   My IP
HTTP  TCP   80   0.0.0.0/0

Later, when HTTPS is configured:

HTTPS TCP   443  0.0.0.0/0

Do NOT expose:

3000
5432
8081

to the public Internet.

16. Verify host port 80
sudo ss -lntp | grep ':80'

Docker should be publishing port 80.

Also:

docker ps

Expected:

0.0.0.0:80->80/tcp
17. Open the application

Open:

http://13.62.74.24

Test:

Landing/sign-in page
Sign-up
Login
Session persistence
Redirects
Onboarding
API calls

For browser debugging, open DevTools → Network.

For the initial HTTP deployment, NextAuth should use:

NEXTAUTH_URL=http://13.62.74.24
18. Important NextAuth redirect issue

If the browser shows:

onboarding 307
sign-in?callbackUrl=%2Fonboarding

that can be normal when the user is unauthenticated.

However, if login/session behavior redirects to the wrong protocol, check:

docker exec web printenv NEXTAUTH_URL

For the initial HTTP deployment it should be:

http://13.62.74.24
19. Final container architecture

The desired production topology is:

Internet
   |
   | :80
   v
+--------+
| Nginx  |
+--------+
   |
   | Docker network
   v
+--------+
|  Web   | :3000
+--------+
   |
   +----------------+
   |                |
   v                v
+--------+      +--------+
| Worker |      | Postgres|
| :8081  |      | :5432  |
+--------+      +--------+

Only Nginx is exposed to the Internet.

20. Domain + HTTPS — later

After the IP deployment is confirmed:

Create an A record:
your-domain.com -> 13.62.74.24
Open AWS Security Group port 443:
HTTPS TCP 443 0.0.0.0/0
Configure Nginx for HTTPS.
Install/use a Let's Encrypt certificate.
Change:
NEXTAUTH_URL=http://13.62.74.24

to:

NEXTAUTH_URL=https://your-domain.com
Recreate the Web container:
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate web
Test:
https://your-domain.com
21. Useful troubleshooting commands
All containers
docker ps -a
Compose status
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
Web logs
docker logs --tail=200 web
Worker logs
docker logs --tail=200 worker
Nginx logs
docker logs --tail=200 nginx
PostgreSQL logs
docker logs --tail=200 postgres
Nginx → Web connectivity
docker exec nginx wget -qO- http://web:3000/api/health

Expected:

{"status":"ok","checks":{"database":"ok"}}
Web → database health
curl -i http://127.0.0.1/api/health

Expected:

{"status":"ok","checks":{"database":"ok"}}
Current NEXTAUTH_URL
docker exec web printenv NEXTAUTH_URL
Published ports
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
22. Dangerous commands

Do NOT run these unless you intentionally want to destroy production data:

docker compose down -v
docker volume prune
docker system prune --volumes

The -v option removes named volumes, including PostgreSQL data.

23. Quick full reset sequence

If the goal is explicitly a completely clean deployment including an empty database:

cd /opt/elapsed

docker compose -f docker-compose.prod.yml --env-file .env.prod down -v --remove-orphans

cd /opt
sudo rm -rf /opt/elapsed

git clone git@github.com:Yasser-Alnajjar/elapsed.git /opt/elapsed

cd /opt/elapsed

# Create .env.prod before continuing.
nano .env.prod

chmod 600 .env.prod

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

docker ps

docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm --user root worker \
  pnpm --filter @sla/db exec prisma migrate deploy

docker compose -f docker-compose.prod.yml --env-file .env.prod restart web worker

curl -i --max-time 10 http://127.0.0.1/api/health

curl -i --max-time 10 http://13.62.74.24/api/health

If the last command returns:

HTTP/1.1 200 OK

and:

{"status":"ok","checks":{"database":"ok"}}

the application stack is working.

24. Recovery checklist

If something fails, collect these outputs before changing anything:

docker ps -a
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker logs --tail=200 web
docker logs --tail=200 worker
docker logs --tail=200 nginx
docker logs --tail=200 postgres
curl -i --max-time 10 http://127.0.0.1/api/health
docker exec web printenv NEXTAUTH_URL
sudo ss -lntp | grep ':80'

Do not immediately run:

docker compose down -v

because it can destroy the database volume.

Current known-good state from the previous deployment

The following was verified successfully:

EC2 public IP: 13.62.74.24
HTTP port 80: accessible
Nginx: working
Web: healthy
Worker: healthy
PostgreSQL: working
/api/health: HTTP 200
Database health: ok
Browser application: opened successfully
NEXTAUTH_URL for HTTP testing: http://13.62.74.24

The AWS Security Group required:

HTTP TCP 80 0.0.0.0/0

The final production HTTPS setup should later use the domain rather than the raw IP.
```
