FROM node:22.14-bullseye-slim
MAINTAINER Seccom Ltd
RUN mkdir /cms
WORKDIR /cms
COPY . .
RUN apt-get update && \
    apt-get -y install libjemalloc-dev  && \
    echo "/usr/lib/x86_64-linux-gnu/libjemalloc.so" >> /etc/ld.so.preload && \
    apt-get clean && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir /cms/.cache && \
    chmod 777 /cms/.cache && \
    npm uninstall directus-extension-models && \
    npm install
EXPOSE 8055
CMD ["/bin/sh", "-c", "npm run database:migrate && npm run schema:load && npx directus start"]
