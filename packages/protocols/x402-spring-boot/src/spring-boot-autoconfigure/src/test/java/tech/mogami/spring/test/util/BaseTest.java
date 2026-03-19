package tech.mogami.spring.test.util;

import org.springframework.mock.web.MockHttpServletResponse;
import tech.mogami.commons.test.BaseMogamiTest;

import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Base test class.
 */
public class BaseTest extends BaseMogamiTest {

    /**
     * Extracts single-value headers from a MockHttpServletResponse.
     *
     * @param response the MockHttpServletResponse
     * @return a map of header names to their single values
     */
    protected static Map<String, String> getHeaders(MockHttpServletResponse response) {
        return response.getHeaderNames().stream()
                .map(name -> Map.entry(name, Objects.requireNonNull(response.getHeader(name))))
                .filter(entry -> entry.getValue() != null)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

}
