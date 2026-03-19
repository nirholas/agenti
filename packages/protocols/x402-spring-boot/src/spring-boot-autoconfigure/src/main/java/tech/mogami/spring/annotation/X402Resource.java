package tech.mogami.spring.annotation;

import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * Describes a resource protected by x402 payment requirements.
 */
@Documented
@Retention(RUNTIME)
@Target(METHOD)
public @interface X402Resource {

    /**
     * URL of the protected resource.
     *
     * @return the URL
     */
    String url();

    /**
     * Human-readable description of the resource.
     *
     * @return the description
     */
    String description() default "";

    /**
     * MIME type of the resource.
     *
     * @return the MIME type
     */
    String mimeType() default APPLICATION_JSON_VALUE;

}
