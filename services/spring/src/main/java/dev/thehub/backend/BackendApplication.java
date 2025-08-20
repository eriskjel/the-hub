package dev.thehub.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Spring Boot application entry point for The Hub backend service.
 */
@SpringBootApplication
public class BackendApplication {

    /**
     * Starts the Spring application.
     *
     * @param args
     *            optional command-line arguments
     */
    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }
}
