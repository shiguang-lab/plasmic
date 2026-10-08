ARG BASE_IMAGE=nginx:1.29-alpine
FROM ${BASE_IMAGE}
COPY desktop/public/desktop-updates/ /usr/share/nginx/html/desktop-updates/
COPY desktop/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
