package dev.thehub.backend.config;

import java.nio.charset.StandardCharsets;
import java.util.List;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * JWT configuration providing the {@link JwtDecoder} used by the resource
 * server to validate incoming access tokens.
 */
@Configuration
public class JwtConfig {

    /** Audience Supabase Auth puts on access tokens for signed-in users. */
    static final String SUPABASE_USER_AUDIENCE = "authenticated";

    /**
     * Builds a symmetric HS256 {@link JwtDecoder} using the Supabase secret.
     *
     * <p>
     * Only end-user access tokens are accepted: besides a valid signature and
     * expiry, tokens must carry {@code aud=authenticated} and a {@code sub}.
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
        var decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();

        var audience = new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,
                aud -> aud != null && aud.contains(SUPABASE_USER_AUDIENCE));
        var subject = new JwtClaimValidator<String>(JwtClaimNames.SUB, sub -> sub != null && !sub.isBlank());
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefault(), audience, subject));
        return decoder;
    }
}
