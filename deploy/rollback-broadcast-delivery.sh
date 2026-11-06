#!/bin/sh
set -eu
cd /home/dino/forgegrowth
test -f compose.proxy.before-broadcast-delivery-20261106.yml
docker compose stop backend
docker compose run --rm --no-deps --entrypoint node backend -e 'const q=require("./src/queue/sendQueue"); (async()=>{ const jobs=await q.sendQueue.getJobs(["wait","delayed","paused"],0,-1); for(const j of jobs) if(String(j.id).startsWith("delivery-retry-")) await j.remove(); await q.shutdownSendQueue(); })().catch(e=>{console.error(e.message);process.exit(1)});'
cp -p compose.proxy.before-broadcast-delivery-20261106.yml compose.proxy.yml
docker compose up -d --no-deps --pull never backend
