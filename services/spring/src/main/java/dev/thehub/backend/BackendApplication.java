package dev.thehub.backend;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Spring Boot application entry point for The Hub backend service.
 */
@SpringBootApplication
@EnableAsync
public class BackendApplication {

    @Bean(name = "groceryEnrichmentExecutor")
    Executor groceryEnrichmentExecutor() {
        return Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "grocery-enrich");
            t.setDaemon(true);
            return t;
        });
    }

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
