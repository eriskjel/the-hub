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
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]