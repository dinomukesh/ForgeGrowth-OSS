# Preserve the deployed nginx base and proxy settings; replace only web assets.
FROM forgegrowth-velan-web:upstream-c123e5e
COPY . /usr/share/nginx/html
