FROM mcr.microsoft.com/playwright:focal

RUN apt-get update && apt-get install -y unzip
RUN apt-get update && apt-get install -y python3-pip && pip3 install yt-dlp
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

COPY package.json .
COPY bun.lockb .

RUN apt-get update && apt-get -y install libnss3 libatk-bridge2.0-0 libdrm-dev libxkbcommon-dev libgbm-dev libasound-dev libatspi2.0-0 libxshmfence-dev
RUN bun install --frozen-lockfile

COPY . .

RUN bun codegen

EXPOSE $PORT

CMD bun start
