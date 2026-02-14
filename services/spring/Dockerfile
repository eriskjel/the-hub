# --- dev (hot reload via spring-boot:run) ---
FROM maven:3.9-eclipse-temurin-21 AS dev
WORKDIR /app
COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -q -DskipTests dependency:go-offline
COPY src ./src
EXPOSE 8080
CMD ["mvn","spring-boot:run"]

# --- build jar ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/root/.m2 mvn -q -DskipTests package

# --- prod runtime ---
FROM eclipse-temurin:21-jre-alpine AS prod
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
# add curl for healthcheck
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

# Keep tuning; if you ever see musl/ZGC quirks on Pi, drop ZGC first.
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_TOOL_OPTIONS="-XX:+UseZGC -XX:MaxRAMPercentage=70"

EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]