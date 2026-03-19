package tech.mogami.spring.annotation;

import java.lang.annotation.Documented;
import java.lang.annotation.Repeatable;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.ANNOTATION_TYPE;
import static java.lang.annotation.ElementType.METHOD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

/**
 * X402 Pay annotation - Never use this one.
 */
@Repeatable(X402Pay.List.class)
@Retention(RUNTIME)
@Target({METHOD, ANNOTATION_TYPE})
@Documented
public @interface X402Pay {

    /**
     * X402Pay list.
     */
    @Target(METHOD)
    @Retention(RUNTIME)
    @Documented
    @interface List {
        @SuppressWarnings("UnusedReturnValue")
        X402Pay[] value();
    }

}
