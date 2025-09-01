package dev.thehub.backend.common;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;

public class RequestIdFilter implements Filter {
    private static final String HEADER = "X-Request-ID";
    private static final String MDC_KEY = "requestId";

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        try {
            var request = (HttpServletRequest) req;
            var rid = request.getHeader(HEADER);
            if (rid == null || rid.isBlank())
                rid = UUID.randomUUID().toString();
            MDC.put(MDC_KEY, rid);
            chain.doFilter(req, res);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }
}