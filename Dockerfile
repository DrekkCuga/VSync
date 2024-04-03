FROM node:16

ENV PORT=8080
EXPOSE 8080/tcp

RUN apt install -y git
WORKDIR /srv
RUN git clone https://github.com/DrekkCuga/VSync.git /srv/vsync
WORKDIR /srv/vsync
RUN npm install

CMD node server