package tech.mogami.spring.factory.annotation;

import jakarta.servlet.http.HttpServletRequest;
import tech.mogami.commons.payment.PaymentRequirements;

import java.lang.annotation.Annotation;

/**
 * Generic contract for factories that can build PaymentRequirements from a specific X402 payment annotations.
 *
 * @param <A> the annotation type handled by this factory
 */
@SuppressWarnings("unused")
public interface PayFactory<A extends Annotation> {

    /**
     * Builds a PaymentRequirements object from the given annotation.
     *
     * @param request    the HTTP servlet request
     * @param annotation the annotation instance
     * @return the corresponding PaymentRequirements
     */
    PaymentRequirements buildRequirements(A annotation, HttpServletRequest request);

}
