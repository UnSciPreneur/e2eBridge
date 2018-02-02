FROM node:6
WORKDIR /app
COPY package.json /app
RUN npm install
COPY . /app

# invoke the container with a correct command line argument for <MODE>, e.g.,
#>  docker run -d --link elstack --link geth --name e2eBridge e2ebridge:latest follow
ENTRYPOINT [ "node", "index.js" ]
