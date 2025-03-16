FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /app

RUN apt-get update && apt-get install -y unzip software-properties-common

RUN mkdir -p ~/.local/bin && \
  curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/.local/bin/yt-dlp && \
  chmod a+rx ~/.local/bin/yt-dlp

ENV PATH="/root/.local/bin:${PATH}"

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

COPY package.json .
COPY bun.lockb .

RUN bun install --frozen-lockfile

COPY . .

RUN bun codegen

EXPOSE $PORT

CMD bun start
