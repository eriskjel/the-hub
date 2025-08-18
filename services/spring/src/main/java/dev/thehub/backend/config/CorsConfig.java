package dev.thehub.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

@Configuration
public class CorsConfig {

    // Read as a single string with a default; parse ourselves (avoids SpEL pitfalls)
    @Value("${app.cors.allowed-origins:https://skjellevik.online,https://www.skjellevik.online}")
    private String allowedOriginsRaw;

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        final String[] patterns = Arrays.stream(allowedOriginsRaw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);

        return new WebMvcConfigurer() {
            @Override public void addCorsMappings(CorsRegistry reg) {
                reg.addMapping("/api/**")
                        .allowedOriginPatterns(patterns)         // supports wildcards like https://*.vercel.app
                        .allowedMethods("GET","POST","PUT","DELETE","PATCH","OPTIONS","HEAD")
                        .allowedHeaders("*")
                        .allowCredentials(true)
                        .maxAge(3600);
            }
        };
    }
}
