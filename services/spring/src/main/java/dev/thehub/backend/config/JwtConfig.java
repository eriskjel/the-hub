package dev.thehub.backend.config;

import java.nio.charset.StandardCharsets;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * JWT configuration providing the {@link JwtDecoder} used by the resource
 * server to validate incoming access tokens.
 */
@Configuration
public class JwtConfig {

    /**
     * Builds a symmetric HS256 {@link JwtDecoder} using the Supabase secret.
     *
     * @param rawSecret
     *            the Supabase JWT secret in plain text
     * @return a configured JwtDecoder
     */
    @Bean
    JwtDecoder jwtDecoder(@Value("${SUPABASE_JWT_SECRET}") String rawSecret) {
        // Supabase JWT secret is usually plain text (not base64). Use as bytes for
        // HS256:
        var keyBytes = rawSecret.getBytes(StandardCharsets.UTF_8);
        var key = new SecretKeySpec(keyBytes, "HmacSHA256");
        return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    }
}
