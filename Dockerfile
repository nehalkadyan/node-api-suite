# base image
FROM node:24

# create a working directory

WORKDIR /app

# COPY package.json and package-lock.json

COPY package*.json .

# install dependencies

RUN npm install

# copy the source code

# first . -> where to copy from
# second . -> where to paste
COPY . .
# expose the port

EXPOSE 3000

# start the project
CMD [ "node", "/src/server.js" ]