package dev.thehub.backend.common;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FilterConfig {
    @Bean
    public FilterRegistrationBean<RequestIdFilter> requestIdFilter() {
        var reg = new FilterRegistrationBean<>(new RequestIdFilter());
        reg.setOrder(1);
        return reg;
    }
}