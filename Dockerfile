FROM node:6
WORKDIR /app
COPY package.json /app
RUN npm install
COPY . /app
# CMD node index.js
#EXPOSE 8081

CMD [ "npm", "start" ]
# CMD [ "sh" ]
# ENTRYPOINT ["node index.js"]