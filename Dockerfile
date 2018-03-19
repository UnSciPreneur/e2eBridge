FROM node:9-alpine

# harden the base image
RUN npm update -g

# install python
RUN apk add --no-cache bash gcc musl-dev g++
RUN apk add --update make

RUN apk add --no-cache python && \
    python -m ensurepip && \
    rm -r /usr/lib/python*/ensurepip && \
    pip install --upgrade pip setuptools && \
    rm -r /root/.cache

# start with app installation
WORKDIR /app
COPY package.json /app
RUN npm install
COPY . /app

# remove unneccessary packages
RUN apk del g++ gcc python

VOLUME /app/config

# invoke the container with a correct command line argument for <MODE>, e.g.,
#>  docker run -d --link elstack --link geth --name e2eBridge e2ebridge:latest follow
ENTRYPOINT [ "node", "index.js" ]

CMD [ "follow" ]
