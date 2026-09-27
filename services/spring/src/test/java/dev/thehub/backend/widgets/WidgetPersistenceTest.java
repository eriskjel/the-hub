package dev.thehub.backend.widgets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.thehub.backend.widgets.create.CreateWidgetService;
import dev.thehub.backend.widgets.list.WidgetsListController;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.JsonTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * Exercises the application's JSONB queries against an isolated PostgreSQL test
 * database.
 */
@JsonTest
class WidgetPersistenceTest {
    @Autowired
    private ObjectMapper json;
    private SingleConnectionDataSource dataSource;
    private CreateWidgetService create;
    private WidgetSettingsRepository repository;
    private MockMvc mvc;
    private final UUID user = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        var url = System.getenv("HUB_TEST_DATABASE_URL");
        if (url == null && "true".equalsIgnoreCase(System.getenv("CI"))) {
            throw new IllegalStateException("CI must provide HUB_TEST_DATABASE_URL for PostgreSQL tests");
        }
        assumeTrue(url != null, "Set HUB_TEST_DATABASE_URL to run PostgreSQL tests locally");
        assertThat(url).matches("jdbc:postgresql://(localhost|127\\.0\\.0\\.1):[0-9]+/hub_test");
        dataSource = new SingleConnectionDataSource(url, System.getenv("HUB_TEST_DATABASE_USER"),
                System.getenv("HUB_TEST_DATABASE_PASSWORD"), true);
        var jdbc = new JdbcTemplate(dataSource);
        // A connection-local table cannot overwrite persistent application tables.
        jdbc.execute("""
                create temporary table user_widgets (
                    id uuid primary key, instance_id uuid not null, user_id uuid not null,
                    kind text not null, grid jsonb, settings jsonb
                )
                """);
        create = new CreateWidgetService(jdbc, json, 3);
        repository = new WidgetSettingsRepository(jdbc, json);
        mvc = MockMvcBuilders.standaloneSetup(new WidgetsListController(jdbc, json)).setMessageConverters(
                new org.springframework.http.converter.json.MappingJackson2HttpMessageConverter(json)).build();
    }

    @AfterEach
    void tearDown() {
        if (dataSource != null) {
            dataSource.destroy();
        }
    }

    @Test
    void preservesSettingsAndGridAcrossCreateReadAndList() throws Exception {
        var settings = json.readValue("""
                {"query":"melk", "city":"Tromsø", "enabled":true, "limit":7,
                 "price":12.5, "optional":null, "nested":{"items":["a", "b"]}}
                """, new TypeReference<Map<String, Object>>() {
        });
        var grid = Map.<String, Object>of("x", 1, "y", 2, "w", 2, "h", 1);
        var created = create.create(user, WidgetKind.GROCERY_DEALS, settings, grid);
        create.create(UUID.randomUUID(), WidgetKind.GROCERY_DEALS, Map.of("query", "other"), grid);
        var instance = UUID.fromString(created.instanceId());
        var row = repository.findWidget(user, instance).orElseThrow();
        assertThat(row.settings()).isEqualTo(json.valueToTree(settings));
        assertThat(row.grid()).isEqualTo(json.valueToTree(grid));
        assertThat(repository.findWidget(UUID.randomUUID(), instance)).isEmpty();
        assertThat(json.readTree(json.writeValueAsString(created)).path("kind").asText()).isEqualTo("grocery-deals");

        var body = mvc.perform(get("/api/widgets/list").principal(principal())).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString(StandardCharsets.UTF_8);
        var listed = json.readTree(body);
        assertThat(listed.size()).isEqualTo(1);
        assertThat(listed.get(0).path("instanceId").asText()).isEqualTo(created.instanceId());
        assertThat(listed.get(0).path("settings")).isEqualTo(json.valueToTree(settings));
        assertThat(listed.get(0).path("grid")).isEqualTo(json.valueToTree(grid));

        var hidden = mvc.perform(get("/api/widgets/list").param("includeSettings", "false").principal(principal()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(json.readTree(hidden).get(0).path("settings")).isEqualTo(json.createObjectNode());
        var filtered = mvc.perform(get("/api/widgets/list").param("kind", "countdown").principal(principal()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(json.readTree(filtered).size()).isZero();
    }

    @Test
    void allocatesDistinctGridSlotsAndPreservesEmptySettings() {
        var first = create.create(user, WidgetKind.COUNTDOWN, null, null);
        var second = create.create(user, WidgetKind.COUNTDOWN, Map.of(), Map.of());
        assertThat(first.grid()).containsEntry("x", 0).containsEntry("y", 0);
        assertThat(second.grid()).containsEntry("x", 1).containsEntry("y", 0);
        assertThat(repository.findWidget(user, UUID.fromString(first.instanceId())).orElseThrow().settings())
                .isEqualTo(json.createObjectNode());
    }

    @Test
    void detectsDuplicateGrocerySettingsWithPostgresJsonOperators() {
        var settings = Map.<String, Object>of("query", "melk", "city", "Oslo");
        create.create(user, WidgetKind.GROCERY_DEALS, settings, null);
        assertThatThrownBy(() -> create.ensureNoDuplicate(user, WidgetKind.GROCERY_DEALS, settings))
                .isInstanceOf(CreateWidgetService.DuplicateException.class);
        create.ensureNoDuplicate(UUID.randomUUID(), WidgetKind.GROCERY_DEALS, settings);
        create.ensureNoDuplicate(user, WidgetKind.GROCERY_DEALS, Map.of("query", "bread", "city", "Oslo"));
    }

    private JwtAuthenticationToken principal() {
        return new JwtAuthenticationToken(
                Jwt.withTokenValue("test").header("alg", "HS256").subject(user.toString()).build());
    }
}
