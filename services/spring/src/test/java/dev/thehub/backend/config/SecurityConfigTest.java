package dev.thehub.backend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.thehub.backend.widgets.list.WidgetsListController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = WidgetsListController.class)
@Import({SecurityConfig.class, JwtConfig.class, CorsConfig.class})
@TestPropertySource(properties = "SUPABASE_JWT_SECRET=test-secret-that-is-at-least-32-bytes-long!!")
class SecurityConfigTest {

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
}
