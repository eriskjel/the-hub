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
FROM eclipse-temurin:21-jre AS prod
# add curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_TOOL_OPTIONS="-XX:+UseZGC -XX:MaxRAMPercentage=70"
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]