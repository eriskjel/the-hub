package dev.thehub.backend.config;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class HttpConfig {

    @Bean
    RestTemplate restTemplate(RestTemplateBuilder builder,
            @Value("${etilbudsavis.timeout-seconds:6}") long timeoutSeconds) {
        return builder.connectTimeout(Duration.ofSeconds(timeoutSeconds))
                .readTimeout(Duration.ofSeconds(timeoutSeconds)).build();
    }
}