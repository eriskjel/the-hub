package dev.thehub.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Logs the application version (CalVer when built by CI) at startup for easy
 * identification in logs.
 */
@Component
public class VersionLogger implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(VersionLogger.class);

    private final Environment environment;

    public VersionLogger(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        String version = environment.getProperty("info.app.version", "unknown");
        log.info("App version: {}", version);
    }
}
