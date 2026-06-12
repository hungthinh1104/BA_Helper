package com.example.booking;

import org.springframework.web.bind.annotation.PostMapping;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@PostMapping
public @interface BookingPostMapping {
    String value() default "";
}
