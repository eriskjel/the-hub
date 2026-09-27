package dev.thehub.backend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import dev.thehub.backend.widgets.list.WidgetsListController;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@WebMvcTest(controllers = WidgetsListController.class)
@Import({SecurityConfig.class, JwtConfig.class, CorsConfig.class, SecurityConfigTest.ProbeController.class})
@TestPropertySource(properties = {"SUPABASE_JWT_SECRET=test-secret-that-is-at-least-32-bytes-long!!",
        "app.cors.allowed-origins=http://localhost:3000"})
class SecurityConfigTest {

    private static final String SECRET = "test-secret-that-is-at-least-32-bytes-long!!";

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private JdbcTemplate jdbc;

    @Test
    void rejectsAnonymousRequestWithoutCreatingSession() throws Exception {
        var result = mvc.perform(get("/api/widgets/list")).andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate", "Bearer")).andReturn();

        assertThat(result.getRequest().getSession(false)).isNull();
    }

    @Test
    void acceptsSignedUserTokenWithoutCreatingSession() throws Exception {
        var result = mvc.perform(get("/api/widgets/probe").header("Authorization", "Bearer " + token("user")))
                .andExpect(status().isOk()).andExpect(content().string("ok")).andReturn();
        assertThat(result.getRequest().getSession(false)).isNull();
        assertThat(result.getResponse().getHeaders("Set-Cookie")).isEmpty();
    }

    @Test
    void restrictsAdminRoutesToAdminRole() throws Exception {
        mvc.perform(get("/api/admin/probe").header("Authorization", "Bearer " + token("user")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/probe").header("Authorization", "Bearer " + token("admin")))
                .andExpect(status().isOk());
    }

    @Test
    void rejectsInvalidSignedClaimsAndSignature() throws Exception {
        var invalid = new String[]{sign(claims().audience("other").build(), SECRET),
                sign(claims().subject(null).build(), SECRET),
                sign(claims().expirationTime(Date.from(Instant.now().minusSeconds(600))).build(), SECRET),
                sign(claims().build(), "another-secret-that-is-at-least-32-bytes-long!!")};
        for (var token : invalid) {
            mvc.perform(get("/api/widgets/probe").header("Authorization", "Bearer " + token))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Test
    void allowsConfiguredCorsPreflightWithoutAuthentication() throws Exception {
        mvc.perform(options("/api/widgets/probe").header("Origin", "http://localhost:3000")
                .header("Access-Control-Request-Method", "GET")
                .header("Access-Control-Request-Headers", "authorization")).andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void rejectsUnconfiguredCorsOrigin() throws Exception {
        mvc.perform(options("/api/widgets/probe").header("Origin", "https://untrusted.example")
                .header("Access-Control-Request-Method", "GET")).andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    private static JWTClaimsSet.Builder claims() {
        return new JWTClaimsSet.Builder().subject(UUID.randomUUID().toString()).audience("authenticated")
                .expirationTime(Date.from(Instant.now().plusSeconds(600)));
    }

    private static String token(String role) throws Exception {
        return sign(claims().claim("role", "authenticated").claim("app_metadata", Map.of("role", role)).build(),
                SECRET);
    }

    private static String sign(JWTClaimsSet claims, String secret) throws Exception {
        var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        jwt.sign(new MACSigner(secret.getBytes(StandardCharsets.UTF_8)));
        return jwt.serialize();
    }

    @RestController
    static class ProbeController {
        @GetMapping({"/api/widgets/probe", "/api/admin/probe"})
        String probe() {
            return "ok";
        }
    }
}
