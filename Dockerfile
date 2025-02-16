FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .

RUN bun install --frozen-lockfile
RUN bunx playwright install

COPY . .

EXPOSE $PORT

CMD bunx playwright install-deps && bunx playwright install &&bun codegen && bun start
