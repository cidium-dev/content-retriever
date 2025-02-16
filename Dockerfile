FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lockb .

RUN bun install --frozen-lockfile
RUN npx playwright install

COPY . .

EXPOSE $PORT

CMD bun codegen && bun start
