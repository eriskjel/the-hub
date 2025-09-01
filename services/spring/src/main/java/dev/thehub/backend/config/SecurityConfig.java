package dev.thehub.backend.config;

import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Spring Security configuration for the backend.
 *
 * <p>
 * Enables method security and configures the application as an OAuth2 Resource
 * Server that validates JWTs. Public endpoints include /health and
 * /actuator/**. All other endpoints require authentication; /api/admin/**
 * requires role ADMIN.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    /**
     * Extracts roles from JWT claims and maps them to Spring Security authorities
     * with the ROLE_ prefix. Supports roles in app_metadata.role(s) and top-level
     * role(s).
     */
    @Bean
    JwtAuthenticationConverter jwtAuthConverter() {
        var conv = new JwtAuthenticationConverter();
        conv.setJwtGrantedAuthoritiesConverter(jwt -> {
            var claims = jwt.getClaims();

            @SuppressWarnings("unchecked")
            var appMeta = (Map<String, Object>) claims.getOrDefault("app_metadata", Map.of());

            var out = new java.util.LinkedHashSet<String>();

            // roles: ["admin", "editor"]
            var rolesObj = appMeta.get("roles");
            if (rolesObj instanceof java.util.Collection<?> col) {
                col.forEach(x -> {
                    if (x != null)
                        out.add(x.toString());
                });
            }

            // role: "user"
            var roleObj = appMeta.get("role");
            if (roleObj != null)
                out.add(roleObj.toString());

            // Optional: also accept a top-level "role"/"roles" if your IdP ever puts them
            // there
            var topRoles = claims.get("roles");
            if (topRoles instanceof java.util.Collection<?> col2)
                col2.forEach(x -> out.add(x.toString()));
            var topRole = claims.get("role");
            if (topRole != null)
                out.add(topRole.toString());

            return out.stream().map(String::trim).filter(s -> !s.isEmpty()).map(String::toUpperCase) // "admin" ->
                                                                                                     // "ADMIN"
                    .map(r -> "ROLE_" + r) // Spring role prefix
                    .map(org.springframework.security.core.authority.SimpleGrantedAuthority::new)
                    .collect(java.util.stream.Collectors.toList());
        });
        return conv;
    }

    /**
     * Configures the HTTP security filter chain with CORS, CSRF, endpoint
     * authorization, and JWT resource server support.
     */
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationConverter jwtAuthConverter)
            throws Exception {
        return http.csrf(AbstractHttpConfigurer::disable).cors(Customizer.withDefaults())
                .authorizeHttpRequests(reg -> reg
                        .requestMatchers("/swagger-ui", "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**")
                        .permitAll().requestMatchers("/health", "/actuator/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/widgets/**").authenticated()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN").anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthConverter)))
                .build();
    }
}
