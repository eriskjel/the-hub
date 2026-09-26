package dev.thehub.backend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidationException;

class JwtConfigTest {

    private static final String SECRET = "test-secret-that-is-at-least-32-bytes-long!!";

    private final JwtDecoder decoder = new JwtConfig().jwtDecoder(SECRET);

    @Test
    void acceptsSignedInUserToken() throws Exception {
        var sub = UUID.randomUUID().toString();
        var token = sign(new JWTClaimsSet.Builder().subject(sub).audience("authenticated")
                .claim("role", "authenticated").expirationTime(Date.from(Instant.now().plusSeconds(600))).build());

        assertThat(decoder.decode(token).getSubject()).isEqualTo(sub);
    }

    @Test
    void rejectsAnonKey() throws Exception {
        // Non-user token: role claim only, no aud, no sub.
        var token = sign(new JWTClaimsSet.Builder().issuer("supabase").claim("role", "anon")
                .expirationTime(Date.from(Instant.now().plusSeconds(86400))).build());

        assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtValidationException.class);
    }

    @Test
    void rejectsServiceRoleKey() throws Exception {
        var token = sign(new JWTClaimsSet.Builder().issuer("supabase").claim("role", "service_role")
                .expirationTime(Date.from(Instant.now().plusSeconds(86400))).build());

        assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtValidationException.class);
    }

    @Test
    void rejectsTokenWithoutSubject() throws Exception {
        var token = sign(new JWTClaimsSet.Builder().audience("authenticated")
                .expirationTime(Date.from(Instant.now().plusSeconds(600))).build());

        assertThatThrownBy(() -> decoder.decode(token)).isInstanceOf(JwtValidationException.class);
    }

    private static String sign(JWTClaimsSet claims) throws Exception {
        var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        jwt.sign(new MACSigner(SECRET.getBytes(StandardCharsets.UTF_8)));
        return jwt.serialize();
    }
}
