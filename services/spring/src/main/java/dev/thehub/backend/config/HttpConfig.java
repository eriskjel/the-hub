package dev.thehub.backend.config;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.client.RestTemplate;

/**
 * HTTP client configuration for outbound calls.
 *
 * <p>
 * Exposes a default RestTemplate (short timeout for Etilbudsavis) and an
 * optional geminiRestTemplate with longer read timeout for the Gemini API.
 */
@Configuration
public class HttpConfig {

    @Bean
    @Primary
    RestTemplate restTemplate(RestTemplateBuilder builder,
            @Value("${etilbudsavis.timeout-seconds:6}") long timeoutSeconds) {
        return builder.connectTimeout(Duration.ofSeconds(timeoutSeconds))
                .readTimeout(Duration.ofSeconds(timeoutSeconds)).build();
    }

    @Bean(name = "geminiRestTemplate")
    RestTemplate geminiRestTemplate(RestTemplateBuilder builder,
            @Value("${groceries.gemini.timeout-seconds:15}") int timeoutSeconds) {
        return builder.connectTimeout(Duration.ofSeconds(timeoutSeconds))
                .readTimeout(Duration.ofSeconds(timeoutSeconds)).build();
    }
}