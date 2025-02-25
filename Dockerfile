FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /app

RUN add-apt-repository ppa:tomtomtom/yt-dlp && \
  apt-get update && \
  apt-get install -y \
  unzip \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm-dev \
  libxkbcommon-dev \
  libgbm-dev \
  libasound-dev \
  libatspi2.0-0 \
  libxshmfence-dev \
  software-properties-common \
  yt-dlp

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

COPY package.json .
COPY bun.lockb .

RUN bun install --frozen-lockfile

COPY . .

RUN bun codegen

EXPOSE $PORT

CMD bun start
